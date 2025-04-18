import pytest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import time

@pytest.fixture
def mobile_driver():
    """Fixture for mobile Chrome driver"""
    mobile_emulation = {
        "deviceMetrics": { "width": 360, "height": 640, "pixelRatio": 3.0 },
        "userAgent": "Mozilla/5.0 (Linux; Android 10; SM-G960F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Mobile Safari/537.36"
    }
    options = Options()
    options.add_experimental_option("mobileEmulation", mobile_emulation)
    options.add_argument('--headless')
    options.add_argument('--disable-gpu')
    options.add_argument('--no-sandbox')
    options.add_argument('--enable-speech-dispatcher')
    options.set_capability('goog:loggingPrefs', {'browser': 'ALL'})
    
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    driver.set_script_timeout(20)
    yield driver
    driver.quit()

@pytest.fixture
def desktop_driver():
    """Fixture for desktop Chrome driver"""
    options = Options()
    options.add_argument('--headless')
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    driver.execute_cdp_cmd('Console.enable', {})  # Enable console logs
    yield driver
    driver.quit()

def print_logs(driver, prefix=""):
    """Helper function to print console logs for debugging"""
    logs = driver.get_log('browser')
    if logs:
        print(f"\n{prefix} Console logs:")
        for log in logs:
            print(f"  {log['message']}")
    else:
        print(f"\n{prefix} No console logs found")
    return logs

def wait_for_voices(driver, timeout=10):
    """Wait for voices to be initialized"""
    start_time = time.time()
    while time.time() - start_time < timeout:
        logs = driver.get_log('browser')
        for log in logs:
            if 'Voice initialization successful' in log['message']:
                return True
            if 'voices changed event triggered' in log['message'].lower():
                return True
        time.sleep(1)
    return False

def test_speech_synthesis_initialization(mobile_driver):
    """Test that speech synthesis is properly initialized on mobile"""
    mobile_driver.get('http://localhost:5000')
    
    # Execute JavaScript to force voices to load
    mobile_driver.execute_script("""
        if ('speechSynthesis' in window) {
            window.speechSynthesis.getVoices();
        }
    """)
    
    # Wait for initialization
    assert wait_for_voices(mobile_driver), "Speech synthesis initialization timed out"
    
    # Check if speak buttons are visible
    speak_buttons = mobile_driver.find_elements(By.CLASS_NAME, 'speak-button')
    assert len(speak_buttons) > 0, "Speak buttons not found"
    assert all(button.is_displayed() for button in speak_buttons), "Not all speak buttons are visible"

def test_speech_synthesis_voice_selection(mobile_driver):
    """Test that male voices are selected correctly"""
    mobile_driver.get('http://localhost:5000')
    
    # Execute JavaScript to force voices to load
    mobile_driver.execute_script("""
        if ('speechSynthesis' in window) {
            window.speechSynthesis.getVoices();
        }
    """)
    
    # Wait for initialization
    assert wait_for_voices(mobile_driver), "Speech synthesis initialization timed out"
    
    # Click the speak button to trigger voice selection
    speak_button = WebDriverWait(mobile_driver, 10).until(
        EC.element_to_be_clickable((By.CSS_SELECTOR, '.card-front .speak-button'))
    )
    speak_button.click()
    time.sleep(2)
    
    # Get all logs
    logs = mobile_driver.get_log('browser')
    
    # Look for voice selection evidence
    voice_related_logs = [log for log in logs if any(term in log['message'].lower() 
        for term in ['voice', 'speech', 'pitch', 'selected'])]
    assert len(voice_related_logs) > 0, "No voice-related logs found"
    
    # Verify no female voices were selected
    female_indicators = ['female', 'alice', 'anna', 'mary', 'victoria', 'milena']
    selected_voice_logs = [log for log in voice_related_logs if 'selected' in log['message'].lower()]
    for log in selected_voice_logs:
        for indicator in female_indicators:
            assert indicator.lower() not in log['message'].lower(), f"Female voice {indicator} was selected"

def test_speak_button_functionality(mobile_driver):
    """Test that speak buttons trigger speech synthesis"""
    mobile_driver.get('http://localhost:5000')
    
    # Wait for initialization
    assert wait_for_voices(mobile_driver), "Speech synthesis initialization timed out"
    
    # Clear logs before clicking
    mobile_driver.get_log('browser')
    
    # Click the speak button
    speak_button = WebDriverWait(mobile_driver, 10).until(
        EC.element_to_be_clickable((By.CSS_SELECTOR, '.card-front .speak-button'))
    )
    speak_button.click()
    time.sleep(2)
    
    # Get new logs
    logs = mobile_driver.get_log('browser')
    speech_logs = [log for log in logs if any(term in log['message'].lower() 
        for term in ['speech', 'voice', 'speak', 'utterance'])]
    
    assert len(speech_logs) > 0, "No speech synthesis activity detected"
    
    # Verify no errors occurred
    error_logs = [log for log in logs if 'error' in log['message'].lower()]
    assert len(error_logs) == 0, f"Speech synthesis errors found: {error_logs}"

def test_voice_pitch_settings(mobile_driver):
    """Test that voice pitch is set correctly for masculine sound"""
    mobile_driver.get('http://localhost:5000')
    
    # Wait for initialization
    assert wait_for_voices(mobile_driver), "Speech synthesis initialization timed out"
    
    # Clear logs before clicking
    mobile_driver.get_log('browser')
    
    # Click the speak button
    speak_button = WebDriverWait(mobile_driver, 10).until(
        EC.element_to_be_clickable((By.CSS_SELECTOR, '.card-front .speak-button'))
    )
    speak_button.click()
    time.sleep(2)
    
    # Get new logs
    logs = mobile_driver.get_log('browser')
    
    # Look for pitch settings
    pitch_logs = [log for log in logs if 'pitch' in log['message'].lower()]
    assert len(pitch_logs) > 0, "No pitch settings found in logs"
    
    # Verify the pitch is set to 0.7 for masculine sound
    masculine_pitch_logs = [log for log in logs if '0.7' in log['message']]
    assert len(masculine_pitch_logs) > 0, "Masculine pitch setting (0.7) not found"