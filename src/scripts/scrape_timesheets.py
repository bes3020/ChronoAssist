
# Conceptual Python script using Helium for web scraping
# To run this, you'll need to install Helium: pip install helium
# And a compatible web driver (e.g., ChromeDriver for Chrome)

from helium import (
    start_chrome, click, S, TextField, Button, get_driver,
    scroll_down, find_all, go_to, press, ENTER, write, kill_browser,
    wait_until
)
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

def get_date_three_months_ago():
    """Helper to get the date three months ago for filtering."""
    return datetime.now() - timedelta(days=90)

def scrape_timesheet_data():
    """
    Scrapes timesheet data from XYZ.com.
    This is a conceptual script and needs actual selectors and logic for XYZ.com.
    """
    entries = []
    driver = None
    
    try:
        log_message("Starting Chrome browser...")
        # Check if running in a headless environment (common for servers)
        # Helium might require additional setup for headless, or it might not be feasible
        # for sites requiring interactive login.
        # For now, assume non-headless for interactive login.
        start_chrome(headless=False) # Explicitly non-headless for login
        driver = get_driver()
        log_message("Chrome browser started.")
        
        # 1. Go to XYZ.com and wait for user login
        target_url = "https://bnext-prd.operations.dynamics.com/?cmp=DAT&mi=PSOTSTimesheetUserWorkSpace"
        log_message(f"Navigating to {target_url}")
        go_to(target_url)
        
        log_message("Please log in to XYZ.com in the browser window that opened.")
        log_message("The script will wait for up to 2 minutes for login to complete.")
        log_message("After logging in and reaching the timesheet workspace, press Enter in THIS console to continue scraping...")
        
        # Give user time to login. Timeout after 2 minutes.
        # This input() call will block here.
        # In a fully automated server context, this interactive step would be an issue.
        # For this tool, where a user is present, it's a workaround.
        # Python's input() doesn't have a direct timeout.
        # A more complex solution would involve threads or async, but for simplicity:
        print("PYTHON_USER_PROMPT: Press Enter here after login and page load...")
        sys.stdin.readline() # Waits for user to press enter in the console running the Python script
        log_message("User indicated login complete. Proceeding with scraping.")

        # 2. Click on the timesheets button/link
        # Replace 'Timesheet transactions' with the actual text or robust selector
        timesheet_link_text = "Timesheet transactions" # This is a guess, adjust based on actual UI
        log_message(f"Attempting to click the '{timesheet_link_text}' link/button...")
        
        # It's better to wait for the element to be present
        try:
            # Example: Wait for a known element on the workspace page after login
            # wait_until(S("#some_element_on_workspace_page").exists, timeout_secs=30)
            # log_message("Workspace page loaded.")
            
            if S(f"//*[text()='{timesheet_link_text}']").exists(): # Example XPath
                 click(timesheet_link_text)
            elif S(f"button[aria-label*='{timesheet_link_text}']").exists(): # Example CSS selector
                 click(S(f"button[aria-label*='{timesheet_link_text}']"))
            else:
                log_message(f"Could not find '{timesheet_link_text}' by common methods. Please check selectors.")
                # If not found, you might try other selectors or raise an error
                # For now, we'll attempt to proceed, but it will likely fail if this click is crucial.
                # raise Exception(f"'{timesheet_link_text}' button/link not found.")
                pass # Allowing to proceed to see if page is already correct or if other elements can be found

            log_message(f"Clicked '{timesheet_link_text}'. Waiting for data grid to load (approx 10 seconds)...")
            time.sleep(10) # Increased wait time for grid loading
        except Exception as e_click:
            log_message(f"Error clicking '{timesheet_link_text}': {e_click}. The page might not have loaded as expected or the selector is incorrect.")
            # Decide if to continue or exit. For now, try to continue if possible.
            
        # 3. Capture data in the grid
        three_months_ago_date = get_date_three_months_ago()
        
        # Placeholder for actual selectors - THESE ARE CRITICAL and need to be accurate
        # Using more generic XPath examples, adapt these carefully.
        ROW_SELECTOR_XPATH = "//div[@role='grid']//div[@role='row']"  # Example: Find rows in a grid
        # Cell selectors relative to the row, or more specific paths:
        # DATE_CELL_XPATH = ".//div[@role='gridcell'][@aria-colindex='1']" # Example: cell in col 1
        # PROJECT_CELL_XPATH = ".//div[@role='gridcell'][@aria-colindex='2']"
        # ACTIVITY_CELL_XPATH = ".//div[@role='gridcell'][@aria-colindex='3']"
        # WORKITEM_CELL_XPATH = ".//div[@role='gridcell'][@aria-colindex='4']"
        # HOURS_CELL_XPATH = ".//div[@role='gridcell'][@aria-colindex='5']"
        # COMMENT_CELL_XPATH = ".//div[@role='gridcell'][@aria-colindex='6']"
        # These colindex values are guesses. Use browser dev tools to find correct ones.

        log_message("Attempting to find data rows using XPath: " + ROW_SELECTOR_XPATH)
        
        processed_row_texts = set() # To help avoid duplicates from overlapping scrolls
        max_scrolls = 20 
        scroll_count = 0
        
        page_changed_after_scroll = True # Assume first time it might change

        while scroll_count < max_scrolls and page_changed_after_scroll:
            page_changed_after_scroll = False
            current_row_elements = find_all(S(ROW_SELECTOR_XPATH))
            
            if not current_row_elements:
                log_message(f"No data rows found with selector '{ROW_SELECTOR_XPATH}' on scroll {scroll_count + 1}. Check selector or if page content loaded.")
                if scroll_count == 0: # No rows on first attempt
                    log_message("No rows found on initial load. Aborting data extraction from grid.")
                    break 
                # If rows were found previously, assume end of data.
                log_message("Assuming end of scrollable data.")
                break

            log_message(f"Found {len(current_row_elements)} potential row elements on scroll {scroll_count + 1}.")

            earliest_date_this_scroll = datetime.now()

            for row_idx, row_element in enumerate(current_row_elements):
                try:
                    # Get all cell texts for the current row.
                    # This is a common pattern but highly dependent on the grid's HTML.
                    # It assumes cells are direct children or easily selectable.
                    cells = row_element.web_element.find_elements("xpath", ".//div[@role='gridcell']")
                    
                    if len(cells) < 6: # Adjust if more/less columns are expected
                        log_message(f"Row {row_idx} has {len(cells)} cells, expected at least 6. Skipping.")
                        continue

                    # Extract text from cells. Be mindful of indexing if columns change.
                    # These indices (0,1,2,etc.) are highly dependent on the table structure.
                    # Use browser's DevTools to confirm the correct column order and indices.
                    date_str = cells[0].text.strip() if len(cells) > 0 else ""
                    project_str = cells[1].text.strip() if len(cells) > 1 else ""
                    activity_str = cells[2].text.strip() if len(cells) > 2 else ""
                    workitem_str = cells[3].text.strip() if len(cells) > 3 else ""
                    hours_str = cells[4].text.strip() if len(cells) > 4 else "0" # Default to 0 if missing
                    comment_str = cells[5].text.strip() if len(cells) > 5 else ""

                    # Basic validation
                    if not date_str or not project_str: # Date and Project are essential
                        log_message(f"Essential data (Date/Project) missing in row {row_idx}. Date: '{date_str}', Project: '{project_str}'. Skipping.")
                        continue
                    
                    # Create a unique identifier for the row content to check for duplicates
                    row_content_tuple = (date_str, project_str, activity_str, workitem_str, hours_str, comment_str)
                    if row_content_tuple in processed_row_texts:
                        continue # Skip already processed row
                    processed_row_texts.add(row_content_tuple)
                    page_changed_after_scroll = True # New unique row found

                    # Date parsing and filtering
                    try:
                        # Attempt to parse common date formats or the specific one from the site
                        # Example: "MM/DD/YYYY", "YYYY-MM-DD"
                        entry_date_obj = datetime.strptime(date_str, "%m/%d/%Y") # Adjust format as needed
                        formatted_date_str = entry_date_obj.strftime("%Y-%m-%d") # Standardize
                        if entry_date_obj < earliest_date_this_scroll:
                            earliest_date_this_scroll = entry_date_obj
                    except ValueError:
                        log_message(f"Could not parse date string: '{date_str}' for row {row_idx}. Skipping date filter for this row, but will include.")
                        # Fallback to using the raw date_str if parsing fails, or skip row
                        formatted_date_str = date_str # Or handle as an error / skip

                    # Convert hours to float
                    try:
                        hours_float = float(hours_str) if hours_str else 0.0
                    except ValueError:
                        log_message(f"Could not parse hours string: '{hours_str}' for row {row_idx}. Defaulting to 0.")
                        hours_float = 0.0
                    
                    entry_data = {
                        "Date": formatted_date_str, 
                        "Project": project_str, 
                        "Activity": activity_str, 
                        "WorkItem": workitem_str, 
                        "Hours": hours_float, 
                        "Comment": comment_str
                    }
                    entries.append(entry_data)

                except Exception as e_row:
                    log_message(f"Error processing a row ({row_idx}): {e_row}. Row text (if available): {row_element.web_element.text if row_element and hasattr(row_element.web_element, 'text') else 'N/A'}")
                    continue
            
            # Check if the earliest date found in this scroll pass is older than 3 months
            if earliest_date_this_scroll < three_months_ago_date:
                log_message("Reached data older than 3 months based on earliest date in current view. Stopping scroll.")
                break

            if not page_changed_after_scroll and scroll_count > 0:
                 log_message("No new unique entries found after scroll. Assuming end of data.")
                 break
            
            log_message(f"Scrolling down... (Scroll attempt {scroll_count + 1})")
            # Try to scroll the main window, or a specific scrollable element if identified.
            # driver.execute_script("window.scrollBy(0, 500);") # Generic JS scroll
            scroll_down(num_pixels=800) # Helium's scroll_down
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
        # sys.exit(1) # Indicate failure to Node.js
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
    
    log_message("Python script execution started.")
    scrape_timesheet_data()
    log_message("Python script execution finished.")

    
