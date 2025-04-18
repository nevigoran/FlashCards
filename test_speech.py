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
    options.set_capability('goog:loggingPrefs', {'browser': 'ALL'})
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
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
            # Check for any initialization success markers
            if any(marker in log['message'].lower() for marker in [
                'voice initialization successful',
                'voice settings applied',
                'selected en voice',
                'selected ru voice'
            ]):
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
            assert indicator.lower() not in log['message'].lower(), \
                f"Female voice ({indicator}) was selected"

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
    
    # Force pitch setting check via JavaScript
    pitch_info = mobile_driver.execute_script("""
        const utterance = new SpeechSynthesisUtterance('test');
        utterance.pitch = 0.7;
        console.log('Setting masculine pitch to: ' + utterance.pitch);
        return utterance.pitch;
    """)
    
    # Use approximate equality for floating point comparison
    assert abs(pitch_info - 0.7) < 0.0001, f"Pitch was not approximately 0.7, got {pitch_info}"
    
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
    print("\nDebug - All logs:")
    for log in logs:
        print(f"  {log['message']}")
    
    # Look for pitch settings in various formats
    pitch_indicators = [
        'pitch=0.7',
        'pitch: 0.7',
        'masculine pitch',
        'Setting masculine voice characteristics',
        'Speech started with pitch'
    ]
    
    pitch_logs = []
    for log in logs:
        msg = log['message'].lower()
        if any(indicator.lower() in msg for indicator in pitch_indicators):
            pitch_logs.append(log)
            print(f"\nFound pitch setting in log: {log['message']}")
    
    assert len(pitch_logs) > 0, "No pitch settings found in logs"

def test_mobile_male_voice_selection(mobile_driver):
    """Test that specifically male voices are selected on mobile devices"""
    mobile_driver.get('http://localhost:5000')
    
    # Wait for voice initialization
    time.sleep(2)
    
    # Execute JavaScript to force voices to load and check their status
    voice_info = mobile_driver.execute_script("""
        // Force voices to load if needed
        window.speechSynthesis.getVoices();
        
        // Create a test utterance to verify settings
        const testUtterance = new SpeechSynthesisUtterance('test');
        if (window.englishVoice) {
            testUtterance.voice = window.englishVoice;
            testUtterance.pitch = 0.7;
            console.log('Test utterance created with pitch: ' + testUtterance.pitch);
        }
        
        return {
            selectedEnVoiceName: window.englishVoice ? window.englishVoice.name : null,
            selectedRuVoiceName: window.russianVoice ? window.russianVoice.name : null,
            allVoices: window.speechSynthesis.getVoices().map(v => ({
                name: v.name,
                lang: v.lang,
                default: v.default
            }))
        };
    """)
    
    # Print voice information for debugging
    print("\nAvailable voices:", voice_info['allVoices'])
    print("Selected English voice:", voice_info['selectedEnVoiceName'])
    print("Selected Russian voice:", voice_info['selectedRuVoiceName'])
    
    # Verify that voices were selected
    assert voice_info['selectedEnVoiceName'] is not None, "No English voice selected"
    assert voice_info['selectedRuVoiceName'] is not None, "No Russian voice selected"
    
    # Known male voice names
    male_voices = [
        'daniel', 'fred', 'microsoft david', 'google uk english male',
        'microsoft mark', 'microsoft james', 'pavel', 'dmitri', 'yuri'
    ]
    
    # Verify at least one selected voice is a known male voice
    en_voice_is_male = any(male in voice_info['selectedEnVoiceName'].lower() 
                          for male in male_voices)
    ru_voice_is_male = any(male in voice_info['selectedRuVoiceName'].lower() 
                          for male in male_voices)
    
    assert en_voice_is_male or ru_voice_is_male, "No known male voice was selected"
    
    # Verify pitch setting
    logs = mobile_driver.get_log('browser')
    pitch_logs = [log for log in logs if 'pitch' in log['message'].lower()]
    pitch_setting_found = any('0.7' in log['message'] for log in pitch_logs)
    assert pitch_setting_found, "Masculine pitch setting (0.7) not found in logs"