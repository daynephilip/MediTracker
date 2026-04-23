from apscheduler.schedulers.background import BackgroundScheduler
import datetime
import logging
from memory import get_connection

logging.basicConfig(level=logging.INFO)

scheduler = BackgroundScheduler()

def check_reminders():
    """Check for due medications and trigger notifications (logs for now, push via WebSocket/FCM in prod)."""
    logging.info(f"Checking reminders at {datetime.datetime.now()}")
    conn = get_connection()
    cursor = conn.cursor()
    # In a real app, parse the 'time' column properly
    # For now, just a stub
    cursor.execute("SELECT id, user_id, name, time FROM medications")
    meds = cursor.fetchall()
    
    current_time = datetime.datetime.now().strftime("%H:%M")
    
    for med in meds:
        med_id, user_id, name, time_str = med
        if time_str == current_time:
            logging.info(f"REMINDER: User {user_id}, it is time to take {name}")
            # Here we would trigger a push notification or websocket message

    conn.close()

def start_scheduler():
    scheduler.add_job(check_reminders, 'interval', minutes=1)
    scheduler.start()
