
# Conceptual Python script using Helium for submitting time entries
# To run this, you'll need to install Helium: pip install helium
# And a compatible web driver (e.g., ChromeDriver for Chrome)

from helium import (
    start_chrome, click, Text, wait_until, find_all,
    go_to, press, kill_browser, Button, TAB, ENTER
)
from selenium.webdriver.chrome.options import Options as ChromeOptions
import json
import sys
from datetime import datetime
import time
import os

# Add a log function to help debug issues when running from Node.js
def log_message(message):
    print(f"PYTHON_SUBMIT_LOG: {message}", file=sys.stderr)

def submit_entries(entries_data):
    """
    Automates submitting time entries to XYZ.com using Helium.
    'entries_data' is a list of dictionaries, each representing a time entry.
    """
    try:
        # Make sure this directory exists or can be created by the script
        profile_base_dir = os.path.expanduser("~/.helium_profiles") # Example: C:\Users\YourUser\.helium_profiles or /home/youruser/.helium_profiles
        profile_dir_name = "azure_ad_session" # Give your profile a name
        persistent_profile_path = os.path.join(profile_base_dir, profile_dir_name)
        driver_options = ChromeOptions()
        driver_options.add_argument(f"--user-data-dir={persistent_profile_path}")

        # Create the base directory if it doesn't exist
        os.makedirs(profile_base_dir, exist_ok=True)
        log_message("Starting Chrome browser...")
        # Check if running in a headless environment (common for servers)
        # Helium might require additional setup for headless, or it might not be feasible
        # for sites requiring interactive login.
        # For now, assume non-headless for interactive login.
        start_chrome(headless=False, options=driver_options) # Explicitly non-headless for login

        log_message("Chrome browser started.")
        
        # 1. Go to XYZ.com and wait for user login
        target_url = "https://bnext-prd.operations.dynamics.com/?cmp=DAT&mi=PSOTSTimesheetUserWorkSpace"
        log_message(f"Navigating to {target_url}")
        go_to(target_url)
        
        wait_until(Text("Time").exists, timeout_secs=200)
        # 2. Click on Registration button
        buttons = find_all(Button("Registration"))
        if(len(buttons) == 0):
            log_message("No Registration button found. Exiting.")
            return {"success": False, "message": "No Registration button found."}
        elif(len(buttons) > 1):
            click(buttons[1])
        else:
            click(buttons[0])
            buttons = find_all(Button("Registration"))        
            click(buttons[1])

        time.sleep(5)
        log_message(f"Received {len(entries_data)} entries to submit.")

        #for x in range(10):
        for index, entry in enumerate(entries_data):
            log_message(f"Processing entry {index + 1}/{len(entries_data)}: Date {entry.get('Date', 'N/A')}, Project {entry.get('Project', 'N/A')}")
            
            wait_until(Button("Hours").exists, timeout_secs=10)
            click(Button("Hours"))
            time.sleep(3) # Wait for new fields to appear

            # Date processing
            date_string = entry.get('Date')
            formatted_date = None
            if date_string:
                try:
                    # Try parsing YYYY-MM-DD
                    date_obj = datetime.strptime(date_string, '%Y-%m-%d')
                    # Format for Windows: "Tue 5/13" using %#m for non-padded month, %#d for non-padded day
                    formatted_date = date_obj.strftime("%a %#m/%#d")
                except ValueError:
                    log_message(f"Warning: Date '{date_string}' (entry index {index}) is not in YYYY-MM-DD format. Trying MM/DD/YYYY.")
                    try:
                        # Try parsing MM/DD/YYYY
                        date_obj = datetime.strptime(date_string, '%m/%d/%Y')
                        formatted_date = date_obj.strftime("%a %#m/%#d")
                    except ValueError:
                        log_message(f"ERROR: Date '{date_string}' (entry index {index}) is not in MM/DD/YYYY format either. Cannot format date.")
                except TypeError:
                        log_message(f"ERROR: Invalid type for date_string ('{date_string}', entry index {index}). Cannot format date.")
            else:
                log_message(f"ERROR: No 'Date' field found in entry at index {index}.")

            if not formatted_date:
                log_message(f"Critical: Failed to determine or format date for entry at index {index} (original date string: '{date_string}'). Skipping this entry.")
                continue # Skip to the next iteration of the for loop

            log_message(f"Processing entry {index + 1}/{len(entries_data)}: Date '{formatted_date}', Project '{entry.get('Project', 'N/A')}', Activity '{entry.get('Activity', 'N/A')}', WorkItem '{entry.get('WorkItem', 'N/A')}', Hours '{entry.get('Hours', 'N/A')}', Comment '{entry.get('Comment', 'N/A')}'")

            press(formatted_date)
            press(TAB)
            press(TAB)
            # press('BIO02001: BioLegend D365 F&SC Implementation')
            press(entry.get('Project', ''))
            press(TAB)
            #press('CR01 Sr Functional Solution Architect')
            press(entry.get('Activity', ''))
            press(TAB)
            # press('Work item')            
            work_item = entry.get('WorkItem', '')
            if work_item:  # Only process if WorkItem has a value
                press(work_item)
                time.sleep(1)
                press(ENTER)
                time.sleep(3)  # Wait for the WorkItem to be selected
            press(TAB)
            press(TAB)
            press(entry.get('Hours', ''))
            press(TAB)
            press(TAB)
            press(TAB)
            press(TAB)
            #press("Test comment")
            press(entry.get('Comment', ''))
            time.sleep(3)
        
        log_message("All entries processed by script (using placeholders).")
        # If successful, return a JSON success message
        return {"success": True, "message": "Time entries processed by Python script (placeholders). Review XYZ.com to confirm submission."}

    except Exception as e:
        log_message(f"An error occurred during the submission process: {str(e)}")
        return {"success": False, "message": f"Python script error during submission: {str(e)}"}
    finally:
        log_message("Submission script attempting to close browser.")
        try:           
            kill_browser()
            log_message("Browser closed after submission attempt.")
        except Exception as e_close:
            log_message(f"Error closing browser after submission attempt: {e_close}")

if __name__ == "__main__":
    log_message("Python time submission script started.")
    
    if len(sys.argv) > 1:
        entries_json_string = sys.argv[1]
        try:
            # The JSON string comes from Node.js and represents List<Omit<TimeEntry, 'id'>>
            entries_list = json.loads(entries_json_string)
            log_message(f"Script received {len(entries_list)} entries to submit via command line argument.")
            result = submit_entries(entries_list)
        except json.JSONDecodeError as e:
            log_message(f"Error decoding JSON input from command line: {e}")
            result = {"success": False, "message": f"Python script JSON decoding error: {e}"}
        except Exception as e_main: # Catch any other unexpected errors in the main block
            log_message(f"An unexpected error occurred in the script's main execution block: {e_main}")
            result = {"success": False, "message": f"Python script unexpected error: {e_main}"}
    else:
        log_message("No time entries data provided to the script via command line argument.")
        result = submit_entries([{"Date": "2025-05-13", "Project": "DIG02003: OneDigital Finance Transformation", "Activity": "Setup and Configuration - Design (3-CapEx)", "WorkItem": "Cus-EA", "Hours": .5, "Comment": "API integration and testing"},
                                 {"Date": "2025-05-13", "Project": "DIG02003: OneDigital Finance Transformation", "Activity": "Setup and Configuration - Design (3-CapEx)", "WorkItem": "Cus-EA", "Hours": .5, "Comment": "API integration and testing"}])
        #result = {"success": False, "message": "Python script: No data received to submit."}
    
    # Output the result as JSON to stdout for Node.js to capture
    print(json.dumps(result))
    log_message("Python time submission script finished.")

