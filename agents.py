import os
from typing import TypedDict
from langgraph.graph import StateGraph, END
from openai import OpenAI
from guardrails import sanitize_input, append_disclaimer
from rag_pipeline import retrieve_context
import json
import base64
import logging

# Groq Cloud API — OpenAI-compatible endpoint
client = OpenAI(
    api_key=os.environ.get("GROQ_API_KEY", ""),
    base_url="https://api.groq.com/openai/v1"
)
MODEL = os.environ.get("GROQ_MODEL", "qwen/qwen3-32b")
VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"

class AgentState(TypedDict):
    user_id: str
    query: str
    context: str
    final_response: str
    error: str

def input_parser(state: AgentState):
    query = sanitize_input(state["query"])
    return {"query": query}

def knowledge_retriever(state: AgentState):
    """Retrieve relevant context from the RAG knowledge base."""
    context = retrieve_context(state["user_id"], state["query"])
    context_str = "\n".join(context) if context else "No specific information found in local database."
    return {"context": context_str}

def llm_responder(state: AgentState):
    """Send the query + context to the LLM for a helpful, conversational answer."""
    prompt = f"""You are a medication safety assistant. A user has asked a question about medications.

Here is relevant information from our database:
---
{state['context']}
---

User Question: {state['query']}

Instructions:
- Answer the user's question directly and helpfully using the context above.
- If the question is about side effects, explain them clearly.
- If the question is about drug interactions, clearly state the interaction and severity.
- If the question is about dosage, provide the typical dosage information.
- If the context doesn't contain enough information, provide a general helpful response but note that the user should verify with a healthcare provider.
- Keep the response concise (2-4 sentences for simple questions, more for complex ones).
- Use plain language that a non-medical person can understand.
- Do NOT wrap your response in JSON or code blocks. Just respond naturally.
- Do NOT add any disclaimer — one will be added automatically.
"""
    
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": "You are a helpful medication safety assistant. Respond in plain, conversational language. Never use JSON format. Never add disclaimers."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=512
        )
        text = response.choices[0].message.content.strip()
        # Handle reasoning models that include <think> tags
        if "<think>" in text and "</think>" in text:
            text = text.split("</think>")[-1].strip()
        print(f"RAW GROQ RESPONSE: {text}")
        return {"final_response": text}
    except Exception as e:
        import traceback
        traceback.print_exc()
        print("ERROR IN GROQ API:", e)
        return {"error": str(e), "final_response": "I encountered an error processing your request. Please try again."}

def response_formatter(state: AgentState):
    """Add the medical disclaimer to the response."""
    response = state.get("final_response", "I encountered an error processing your request.")
    final_response = append_disclaimer(response)
    return {"final_response": final_response}

# Build LangGraph
workflow = StateGraph(AgentState)
workflow.add_node("parse_input", input_parser)
workflow.add_node("retrieve_knowledge", knowledge_retriever)
workflow.add_node("llm_respond", llm_responder)
workflow.add_node("format_response", response_formatter)

workflow.set_entry_point("parse_input")
workflow.add_edge("parse_input", "retrieve_knowledge")
workflow.add_edge("retrieve_knowledge", "llm_respond")
workflow.add_edge("llm_respond", "format_response")
workflow.add_edge("format_response", END)

app_graph = workflow.compile()

def process_query(user_id: str, query: str) -> str:
    """Process a text query through the medication safety agent."""
    inputs = {"user_id": user_id, "query": query}
    for output in app_graph.stream(inputs):
        pass
    
    # Get the final state
    final_state = list(output.values())[0]
    return final_state.get("final_response", "Error processing request.")


def process_image_query(user_id: str, base64_image: str, mime_type: str, message: str = "") -> str:
    """Process an image query using Llama 4 Scout vision model on Groq."""
    try:
        user_prompt = message.strip() if message.strip() else "Identify this medication and provide its name, typical dosage, common side effects, and what it's used for."
        
        response = client.chat.completions.create(
            model=VISION_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You are a medication identification assistant. When shown an image of medication (pills, bottles, packaging), identify the medication and provide helpful information. Be clear and concise. If you cannot identify the medication with confidence, say so honestly."
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": user_prompt
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            temperature=0.3,
            max_tokens=512
        )
        
        text = response.choices[0].message.content.strip()
        # Handle reasoning models that include <think> tags
        if "<think>" in text and "</think>" in text:
            text = text.split("</think>")[-1].strip()
        
        return append_disclaimer(text)
        
    except Exception as e:
        logging.error(f"Vision model error: {e}")
        import traceback
        traceback.print_exc()
        return append_disclaimer("I couldn't analyze the image. Please make sure it's a clear photo of medication and try again.")
