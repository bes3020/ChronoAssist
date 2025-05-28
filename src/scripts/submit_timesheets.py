
# Conceptual Python script using Helium for submitting time entries
# To run this, you'll need to install Helium: pip install helium
# And a compatible web driver (e.g., ChromeDriver for Chrome)

from helium import (
    start_chrome, click, Text, wait_until, find_all,
    go_to, press, kill_browser, Button, TAB, ENTER, write
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

def submit_entries_to_xyz(entries_data):
    """
    Automates submitting time entries to XYZ.com using Helium.
    'entries_data' is a list of dictionaries, each representing a time entry.
    Returns a dictionary with overall success, submitted IDs, and failed entries with errors.
    """
    
    submitted_entry_client_ids = []
    failed_entries_details = []
    all_successful = True

    try:
        profile_base_dir = os.path.expanduser("~/.helium_profiles")
        profile_dir_name = "azure_ad_session"
        persistent_profile_path = os.path.join(profile_base_dir, profile_dir_name)
        driver_options = ChromeOptions()
        driver_options.add_argument(f"--user-data-dir={persistent_profile_path}")
        os.makedirs(profile_base_dir, exist_ok=True)

        log_message("Starting Chrome browser for submission...")
        start_chrome(headless=False, options=driver_options)
        log_message("Chrome browser started.")
        
        target_url = "https://bnext-prd.operations.dynamics.com/?cmp=DAT&mi=PSOTSTimesheetUserWorkSpace"
        log_message(f"Navigating to {target_url}")
        go_to(target_url)
        
        wait_until(Text("Time").exists, timeout_secs=200)
        
        registration_buttons = find_all(Button("Registration"))
        if not registration_buttons:
            log_message("No Registration button found. Exiting submission.")
            # If this critical step fails, all entries are considered failed.
            for entry in entries_data:
                failed_entries_details.append({
                    "client_id": entry.get('id', f"unknown_id_{entries_data.index(entry)}"), # Use 'id' field which is the client_id
                    "error": "Setup Error: Could not find 'Registration' button on page."
                })
            return {
                "overallSuccess": False,
                "message": "Setup Error: Could not find 'Registration' button.",
                "submittedEntryClientIds": [],
                "failedEntries": failed_entries_details
            }
        
        # Heuristic: if multiple "Registration" buttons, the second one might be the correct one.
        # This needs to be verified against the actual UI.
        click_target_registration = registration_buttons[1] if len(registration_buttons) > 1 else registration_buttons[0]
        click(click_target_registration)
        
        time.sleep(5) # Wait for the timesheet entry interface to load
        log_message(f"Ready to process {len(entries_data)} entries for submission.")

        for index, entry in enumerate(entries_data):
            client_id = entry.get('id') # This 'id' is the client_id from the TimeEntry object
            log_message(f"Processing entry {index + 1}/{len(entries_data)} (Client ID: {client_id}): Date {entry.get('Date', 'N/A')}")
            
            # Simulate submission attempt for each entry
            # In a real scenario, this block would contain the Helium calls to fill and submit one entry
            
            # ---- START OF PER-ENTRY SUBMISSION LOGIC (Helium interactions) ----
            try:
                wait_until(Button("Hours").exists, timeout_secs=10) # Wait for the 'Hours' button to ensure the form is ready for a new line.
                click(Button("Hours")) # This likely creates a new row or focuses the entry mechanism.
                time.sleep(3) # Wait for UI to update after click

                # Date processing
                date_string = entry.get('Date')
                formatted_date_for_helium = "" # For Helium's `press` or `write`
                if date_string:
                    try:
                        date_obj = datetime.strptime(date_string, '%Y-%m-%d')
                        formatted_date_for_helium = date_obj.strftime("%a %#m/%#d") # Example: "Tue 5/13"
                    except (ValueError, TypeError) as e_date:
                        log_message(f"Date formatting error for entry {client_id}: {e_date}")
                        raise Exception(f"Invalid date format: {date_string}") # Make this a failure for this entry
                else:
                    raise Exception("Date is missing.")

                log_message(f"Attempting to input: Date '{formatted_date_for_helium}', Proj '{entry.get('Project', '')}', Act '{entry.get('Activity', '')}', WI '{entry.get('WorkItem', '')}', Hrs '{entry.get('Hours', '')}', Cmt '{entry.get('Comment', '')}'")
                
                # Placeholder Helium actions for filling a row
                # These selectors and sequences are highly dependent on the actual web application
                # and need to be determined by inspecting the application's HTML structure.
                
                # Example sequence:
                # press(formatted_date_for_helium) # Input Date
                # press(TAB)
                # press(TAB) # Assuming two tabs to get to Project from Date
                # write(entry.get('Project', '')) # Input Project
                # press(TAB)
                # write(entry.get('Activity', '')) # Input Activity
                # press(TAB)
                # work_item = entry.get('WorkItem', '')
                # if work_item:
                #     write(work_item)
                #     time.sleep(0.5) # Allow for any dynamic updates/validation
                #     press(ENTER) # If WorkItem is a searchable dropdown
                #     time.sleep(1) # Wait for selection
                # press(TAB) # To Hours (assuming it's next after WorkItem or its potential empty slot)
                # press(TAB) # Assuming 2 tabs from WI to hours if WI could be empty
                # write(str(entry.get('Hours', '0'))) # Input Hours
                # press(TAB) # ... and so on for Comment
                # press(TAB)
                # press(TAB)
                # press(TAB)
                # write(entry.get('Comment', ''))
                # time.sleep(1) # Short delay before processing next or "saving" this line

                # SIMULATION: For demonstration, let's make every second entry fail.
                if (index + 1) % 2 != 0: # Odd entries succeed (1st, 3rd, ...)
                    # If actual submission of this line was successful:
                    log_message(f"Successfully processed entry {client_id} (Simulated).")
                    submitted_entry_client_ids.append(client_id)
                else: # Even entries fail (2nd, 4th, ...)
                    log_message(f"Failed to submit entry {client_id} (Simulated error).")
                    all_successful = False
                    failed_entries_details.append({
                        "client_id": client_id,
                        "error": f"Simulated Submission Error for entry {index + 1} (e.g., Invalid WorkItem)."
                    })
            
            except Exception as e_entry:
                log_message(f"Error during processing of entry {client_id}: {str(e_entry)}")
                all_successful = False
                failed_entries_details.append({
                    "client_id": client_id,
                    "error": f"Script error: {str(e_entry)}"
                })
            # ---- END OF PER-ENTRY SUBMISSION LOGIC ----

        if all_successful:
            final_message = f"All {len(entries_data)} entries submitted successfully."
        elif not submitted_entry_client_ids and failed_entries_details:
             final_message = f"All {len(failed_entries_details)} entries failed to submit."
        else:
            final_message = f"Submission complete. {len(submitted_entry_client_ids)} entries submitted, {len(failed_entries_details)} entries failed."
        
        log_message(final_message)
        return {
            "overallSuccess": all_successful,
            "message": final_message,
            "submittedEntryClientIds": submitted_entry_client_ids,
            "failedEntries": failed_entries_details
        }

    except Exception as e_global:
        log_message(f"A critical error occurred in the submission script: {str(e_global)}")
        # Mark all entries as failed if a global error occurs
        critical_failed_entries = []
        for entry in entries_data:
             critical_failed_entries.append({
                "client_id": entry.get('id', f"unknown_id_critical_{entries_data.index(entry)}"),
                "error": f"Critical script error: {str(e_global)}"
            })
        return {
            "overallSuccess": False,
            "message": f"Python script critical error: {str(e_global)}",
            "submittedEntryClientIds": [],
            "failedEntries": critical_failed_entries # All entries marked as failed
        }
    finally:
        log_message("Submission script attempting to close browser.")
        try:           
            kill_browser()
            log_message("Browser closed after submission attempt.")
        except Exception as e_close:
            log_message(f"Error closing browser after submission attempt: {e_close}")

if __name__ == "__main__":
    log_message("Python time submission script started.")
    
    result_payload = {} # Initialize
    if len(sys.argv) > 1:
        entries_json_string = sys.argv[1]
        try:
            # The JSON string comes from Node.js and represents List<TimeEntry>
            # Crucially, TimeEntry has an 'id' which is the client_id
            entries_list_from_node = json.loads(entries_json_string)
            log_message(f"Script received {len(entries_list_from_node)} entries to submit via command line argument.")
            # Pass the list of entry objects, which includes their 'id' (client_id)
            result_payload = submit_entries_to_xyz(entries_list_from_node)
        except json.JSONDecodeError as e:
            log_message(f"Error decoding JSON input from command line: {e}")
            result_payload = {"overallSuccess": False, "message": f"Python script JSON decoding error: {e}", "submittedEntryClientIds": [], "failedEntries": []}
        except Exception as e_main:
            log_message(f"An unexpected error occurred in the script's main execution block: {e_main}")
            result_payload = {"overallSuccess": False, "message": f"Python script unexpected error: {e_main}", "submittedEntryClientIds": [], "failedEntries": []}
    else:
        log_message("No time entries data provided to the script via command line argument. Simulating with placeholder data for script testing.")
        # Example data if run directly without args (for testing script logic)
        placeholder_entries = [
            {"id": "client_id_1", "Date": "2025-05-13", "Project": "Project A", "Activity": "Dev", "WorkItem": "Task 1", "Hours": 1.0, "Comment": "Test 1"},
            {"id": "client_id_2", "Date": "2025-05-13", "Project": "Project B", "Activity": "Meeting", "WorkItem": "Planning", "Hours": 2.0, "Comment": "Test 2"},
            {"id": "client_id_3", "Date": "2025-05-14", "Project": "Project C", "Activity": "Testing", "WorkItem": "Bugfix", "Hours": 3.0, "Comment": "Test 3"}
        ]
        result_payload = submit_entries_to_xyz(placeholder_entries)
        
    print(json.dumps(result_payload))
    log_message("Python time submission script finished.")
