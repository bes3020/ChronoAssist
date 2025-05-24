
# Conceptual Python script using Helium for web scraping
# To run this, you'll need to install Helium: pip install helium
# And a compatible web driver (e.g., ChromeDriver for Chrome)

from helium import (
    start_chrome, click, S, Text, Point,
    find_all, go_to, press, kill_browser, PAGE_DOWN,
    wait_until
)
from selenium.webdriver.chrome.options import Options as ChromeOptions
import json
import time
from datetime import datetime, timedelta
import sys
import os

# Add a log function to help debug issues when running from Node.js
def log_message(message):
    # In a real scenario, you might want to write to a dedicated log file
    # For now, print to stderr so Node.js can capture it if needed
    print(f"PYTHON_SCRIPT_LOG: {message}", file=sys.stderr)

def get_date_days_ago(days=90):
    """Helper to get the date a specified number of days ago for filtering.
    
    Args:
        days (int): Number of days to go back from today
        
    Returns:
        datetime: Date object representing days_ago days in the past
    """
    return datetime.now() - timedelta(days=days)

def scrape_timesheet_data(days_ago=30):
    """
    Scrapes timesheet data from XYZ.com.
    This is a conceptual script and needs actual selectors and logic for XYZ.com.
    Hours are generally not scraped or considered essential for historical context for AI.
    
    Args:
        days_ago (int): Number of days in the past to retrieve data for. Default is 90 days.
    """
    entries = []
    driver = None
    
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
        # 2. Click on the timesheets button/link
        click("Timesheet transactions")
        
        # It's better to wait for the element to be present
        try:
            time.sleep(10) # Increased wait time for grid loading
            log_message("Grid loaded.")                       
            click(Point(340,490))
        except Exception as e_click:
            log_message(f"Error clicking Timesheet transactions': {e_click}. The page might not have loaded as expected or the selector is incorrect.")
            # Decide if to continue or exit. For now, try to continue if possible.
            
        # 3. Capture data in the grid
        target_date = get_date_days_ago(days=days_ago)        
        
        max_scrolls = 10 
        scroll_count = 0
        latest_date_this_scroll = datetime.now() # Initialize with current date

        while scroll_count < max_scrolls:     
            try:
                # Get all cell texts for the current row.
                # This is a common pattern but highly dependent on the grid's HTML.
                date_cells = find_all(S("input[aria-label='Date']"))
                project_cells = find_all(S("input[aria-label='Project']"))
                activity_cells = find_all(S("input[aria-label='Activity']"))
                workitem_cells = find_all(S("input[aria-label='Work item']"))
                # hours_cells are not reliably scraped or needed for AI context.
                external_comments_cells = find_all(S("input[aria-label='External comment']"))
                row_idx = 0
                current_earliest_date = latest_date_this_scroll

                if not date_cells: # No more data to process
                    log_message("No date cells found in current view. Stopping scroll.")
                    break

                for dates_el in date_cells: 
                    date_str = dates_el.web_element.get_attribute('value').strip()
                    project_str = project_cells[row_idx].web_element.get_attribute('value').strip() if row_idx < len(project_cells) else ""
                    activity_str = activity_cells[row_idx].web_element.get_attribute('value').strip() if row_idx < len(activity_cells) else ""
                    workitem_str = workitem_cells[row_idx].web_element.get_attribute('value').strip() if row_idx < len(workitem_cells) else ""
                    comment_str = external_comments_cells[row_idx].web_element.get_attribute('value').strip() if row_idx < len(external_comments_cells) else ""
                    
                    # Log the 5 variables for debugging
                    log_message(f"Row {row_idx} - Date: '{date_str}', Project: '{project_str}', Activity: '{activity_str}', WorkItem: '{workitem_str}', Comment: '{comment_str}'")
                    entry_date_obj = None
                    try:
                        entry_date_obj = datetime.strptime(date_str, "%m/%d/%Y") # Adjust format as needed
                        formatted_date_str = entry_date_obj.strftime("%Y-%m-%d") # Standardize
                        if entry_date_obj < current_earliest_date:
                            current_earliest_date = entry_date_obj
                    except ValueError:
                        log_message(f"Could not parse date string: '{date_str}' for row {row_idx}. Skipping date filter for this row, but will include.")
                        formatted_date_str = date_str # Or handle as an error / skip
                    
                    entry_data = {
                        "Date": formatted_date_str, 
                        "Project": project_str, 
                        "Activity": activity_str, 
                        "WorkItem": workitem_str, 
                        "Hours": "", # Hours are not critical for historical context for AI and often not reliably scraped.
                        "Comment": comment_str
                    }

                    if entry_date_obj < target_date:
                        log_message(f"Reached data older than {days_ago} days based on earliest date in current view. Stopping scroll.")
                        break      
                    # Check if this entry already exists (by Date, Project, Activity, WorkItem)
                    is_duplicate = False
                    for existing_entry in entries:
                        if (existing_entry["Date"] == formatted_date_str and
                            existing_entry["Project"] == project_str and
                            existing_entry["Activity"] == activity_str and
                            existing_entry["WorkItem"] == workitem_str):
                            is_duplicate = True
                            log_message(f"Skipping duplicate entry for {formatted_date_str}/{project_str}/{activity_str}/{workitem_str}")
                            break

                    # Only add the entry if it's not a duplicate
                    if not is_duplicate:
                        entries.append(entry_data)
                    row_idx += 1
                
                latest_date_this_scroll = current_earliest_date

            except Exception as e_row:
                log_message(f"Error processing a row set ({row_idx}): {e_row}")
                # Potentially break or continue depending on severity
                break 
              # Check if the latest date found in this scroll pass is older than the target date
                  
            
            log_message(f"Scrolling down... (Scroll attempt {scroll_count + 1})")
            press(PAGE_DOWN)
            time.sleep(3) # Wait for content to load after scroll
            scroll_count += 1
            
            if scroll_count >= max_scrolls:
                log_message("Reached max scrolls.")
                break
        
        log_message(f"Scraping finished. Total entries collected: {len(entries)}")

    except Exception as e_main:
        log_message(f"An critical error occurred during scraping process: {e_main}")
        # Output an empty JSON array or partial data if preferred on critical error
        # For Node.js, ensure any output is valid JSON.
        print(json.dumps([])) # Output empty list on critical error
        sys.exit(1) # Indicate failure to Node.js
        return # Exit function
    
    finally:
        log_message("Attempting to close browser.")
        try:
            kill_browser() # Helium's function to close the browser
            log_message("Browser closed.")
        except Exception as e_close:
            log_message(f"Error closing browser: {e_close}")

        # Output the collected data as JSON to stdout
        # This will be captured by the Node.js server action
        # Ensure it's always valid JSON, even if empty
        log_message(f"Finalizing. Outputting {len(entries)} entries as JSON.")
        print(json.dumps(entries if entries else []))

if __name__ == "__main__":
    # Redirect stdout to ensure it's UTF-8, which Node.js expects
    # sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf8', buffering=1)
    # sys.stderr = open(sys.stderr.fileno(), mode='w', encoding='utf8', buffering=1)
    
    # Check if days parameter was provided as command line argument
    days = 30  # Default to 90 days
    if len(sys.argv) > 1:
        try:
            days = int(sys.argv[1])
            log_message(f"Using provided days parameter: {days}")
        except ValueError:
            log_message(f"Invalid days parameter provided: {sys.argv[1]}. Using default (30 days)")
    
    log_message("Python script execution started.")
    scrape_timesheet_data(days_ago=days)
    log_message("Python script execution finished.")

    
