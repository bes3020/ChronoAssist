
# Conceptual Python script using Helium for submitting time entries
# To run this, you'll need to install Helium: pip install helium
# And a compatible web driver (e.g., ChromeDriver for Chrome)

from helium import (
    start_chrome, click, Text, wait_until, find_all,
    go_to, press, kill_browser, Button, TAB
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
                    log_message(f"Warning: Date '{date_string}' (entry index {x}) is not in YYYY-MM-DD format. Trying MM/DD/YYYY.")
                    try:
                        # Try parsing MM/DD/YYYY
                        date_obj = datetime.strptime(date_string, '%m/%d/%Y')
                        formatted_date = date_obj.strftime("%a %#m/%#d")
                    except ValueError:
                        log_message(f"ERROR: Date '{date_string}' (entry index {x}) is not in MM/DD/YYYY format either. Cannot format date.")
                except TypeError:
                        log_message(f"ERROR: Invalid type for date_string ('{date_string}', entry index {x}). Cannot format date.")
            else:
                log_message(f"ERROR: No 'Date' field found in entry at index {x}.")

            if not formatted_date:
                log_message(f"Critical: Failed to determine or format date for entry at index {x} (original date string: '{date_string}'). Skipping this entry.")
                continue # Skip to the next iteration of the for loop

            log_message(f"Processing entry {index + 1}/{len(entries_data)}: Date '{formatted_date}', Project '{entry.get('Project', 'N/A')}'")

            press(formatted_date)
            press(TAB)
            press(TAB)
            press('BIO02001: BioLegend D365 F&SC Implementation')
            press(TAB)
            press('CR01 Sr Functional Solution Architect')
            press(TAB)
            press('Work item')
            press(TAB)
            press(TAB)
            press('.25')
            press(TAB)
            press(TAB)
            press(TAB)
            press("Test comment")
            time.sleep(10)

            # Date Field:
            # date_field_selector = "selector_for_date_field" # e.g., helium.TextField("Date") or S("#date-input-id")
            # if helium.S(date_field_selector).exists():
            #     helium.write(entry.get('Date', ''), into=date_field_selector)
            # else:
            #     log_message(f"Date field ('{date_field_selector}') not found for entry {index + 1}.")

            # Project Field (could be text input, dropdown, or combo box):
            # project_field_selector = "selector_for_project_field" # e.g., helium.ComboBox("Project")
            # if helium.S(project_field_selector).exists():
            #     # If it's a ComboBox, you might need to select or type and select
            #     # helium.select(project_field_selector, entry.get('Project', '')) 
            #     # Or if it's a typeable field that then shows a dropdown:
            #     helium.write(entry.get('Project', ''), into=project_field_selector)
            #     # time.sleep(0.5) # Wait for dropdown to appear
            #     # helium.click(entry.get('Project', '')) # Click the matching item in dropdown
            # else:
            #     log_message(f"Project field ('{project_field_selector}') not found for entry {index + 1}.")
            
            # Activity Field:
            # activity_field_selector = "selector_for_activity_field"
            # if helium.S(activity_field_selector).exists():
            #     helium.write(entry.get('Activity', ''), into=activity_field_selector) # Or helium.select if it's a dropdown
            # else:
            #     log_message(f"Activity field ('{activity_field_selector}') not found for entry {index + 1}.")

            # WorkItem Field:
            # workitem_field_selector = "selector_for_workitem_field"
            # if helium.S(workitem_field_selector).exists():
            #     helium.write(entry.get('WorkItem', ''), into=workitem_field_selector) # Or helium.select
            # else:
            #     log_message(f"WorkItem field ('{workitem_field_selector}') not found for entry {index + 1}.")

            # Hours Field:
            # hours_field_selector = "selector_for_hours_field"
            # if helium.S(hours_field_selector).exists():
            #     helium.write(str(entry.get('Hours', 0)), into=hours_field_selector)
            # else:
            #     log_message(f"Hours field ('{hours_field_selector}') not found for entry {index + 1}.")

            # Comment Field:
            # comment_field_selector = "selector_for_comment_field"
            # if helium.S(comment_field_selector).exists():
            #     helium.write(entry.get('Comment', ''), into=comment_field_selector)
            # else:
            #     log_message(f"Comment field ('{comment_field_selector}') not found for entry {index + 1}.")

            # Save or Confirm this specific entry/line (if applicable for XYZ.com):
            # save_line_button_selector = "selector_for_save_line_button"
            # if helium.S(save_line_button_selector).exists():
            #    helium.click(save_line_button_selector)
            #    log_message(f"Clicked 'Save Line' for entry {index + 1}. Waiting for confirmation...")
            #    time.sleep(2) # Adjust wait time for save/confirmation
            # else:
            #    log_message(f"'Save Line' button ('{save_line_button_selector}') not found or not applicable for entry {index + 1}.")
            
            #log_message(f"Placeholder: Entry {index + 1} data (Date: {entry.get('Date')}, Project: {entry.get('Project')}) fields would be filled here.")
            # === END OF HELIUM PLACEHOLDERS FOR DATA ENTRY ===
            time.sleep(0.5) # Small delay between processing each entry, can be adjusted

        # 3. Final submission of the entire timesheet (if applicable for XYZ.com)
        # This step depends on whether entries are saved individually or as a batch.
        # final_submit_button_selector = "selector_for_final_submit_button" # e.g., helium.Button("Submit Timesheet")
        # if helium.S(final_submit_button_selector).exists():
        #    log_message("Attempting final submission of the timesheet...")
        #    helium.click(final_submit_button_selector)
        #    time.sleep(5) # Wait for submission confirmation (adjust as needed)
        #    log_message("Timesheet final submission initiated (placeholder). Check XYZ.com for confirmation.")
        # else:
        #    log_message(f"Final 'Submit Timesheet' button ('{final_submit_button_selector}') not found. Entries might be saved individually or another process is needed.")
        
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
        result = submit_entries([{"Date": "2025-05-13", "Project": "Project Alpha", "Activity": "Development", "WorkItem": "Feature X", "Hours": .5, "Comment": "API integration and testing"},{"Date": "2025-05-13", "Project": "Project Alpha", "Activity": "Development", "WorkItem": "Feature X", "Hours": .5, "Comment": "API integration and testing"},{"Date": "2025-05-13", "Project": "Project Alpha", "Activity": "Development", "WorkItem": "Feature X", "Hours": .5, "Comment": "API integration and testing"}])
        #result = {"success": False, "message": "Python script: No data received to submit."}
    
    # Output the result as JSON to stdout for Node.js to capture
    print(json.dumps(result))
    log_message("Python time submission script finished.")

