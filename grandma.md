Ahmed - Concept
A lot of people have trouble managing multiple prescriptions at the same time. Other than the obvious problem of remembering which pill to take and when, other problems can also be doubts about whether two pills are safe to be taken together, who all shouldn’t take the pill, what is the dosage of the medicine, any important side effects etc. This app has a pill tracker to manage prescriptions that will remind you when to take which pill and a chatbot that helps solve all these problems and doubts that people might have as the prescription leaflet can be hard to follow and may not contain personalized info about the user, such as allergies etc.

The GenAI Part 
Dayne
Creating a mini dictionary/library for medical info (Vector Store): When you ask the chatbot a medical question, the AI doesn't just guess (hallucinate). We implemented sort of a mini dictionary/library (vector store) to organize information by its meaning. The app searches this store/database for the exact safety rules related to your medicine.
Answering using the facts (RAG): Once the facts are found from the vector store, we force the AI to answer based on these facts and not to answer on its own. We implemented this using RAG. What this means is basically, that the AI must retrieve the facts from the Vector Store first, and then generate a simple answer based only on those exact facts. This stops the AI from making things up.

Ahmed
Understanding the images (Vision AI): Instead of typing out hard to spell medicine names or trying to follow the leaflet, you can simply take a picture of your pill bottle or the leaflet of the medicine. The AI looks at the photo, reads the messy label, and automatically writes down the exact name and dosage for you.
Guardrails: If a person tries to ask for any personal or confidential information or to ignore previous instructions, the chatbot refuses to give out this info due to certain strict instructions given to it.

Dayne - Tech Stack 
Here are the tools/tech stack we used:
React & Vite: These tools were used for the front end.
FastAPI : This was used to handle the user requests.
Qwen & Llama: These are the specific AI tools we used. Qwen is the one that talks to you and answers your questions, and Llama is the one that handles the images to look at the
photos of your medicine.
SQLite: This was used to save the medicine schedule. Instead of putting your private health information on a public server, SQLite stores it in a private file.
Firebase: This was used to handle email and password when you log in.
