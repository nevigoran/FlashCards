document.addEventListener("DOMContentLoaded", function() {
    loadNewWord();
    
    // Handle voice initialization for all platforms
    if ('speechSynthesis' in window) {
        // Force initial voices load
        setTimeout(() => {
            window.speechSynthesis.getVoices();
            
            // Initialize immediately if voices are already available
            if (speechSynthesis.getVoices().length > 0) {
                initializeVoices();
            }
        }, 100);
        
        // Primary initialization through voices changed event
        speechSynthesis.onvoiceschanged = function() {
            console.log('Voice list changed - reinitializing voices');
            initializeVoices();
        };
        
        // Additional initialization on first interaction (especially important for mobile)
        document.addEventListener('touchstart', initVoicesOnInteraction, { once: true });
        document.addEventListener('click', initVoicesOnInteraction, { once: true });
    }
});

// Global variables for voice management
let currentWord = null;
let isInitialized = false;
let lastVoiceUpdate = 0;
const VOICE_UPDATE_INTERVAL = 1000; // Minimum time between voice updates

function initVoicesOnInteraction() {
    if (!isInitialized) {
        console.log('Initializing voices on user interaction');
        initializeVoices();
    }
}

function initializeVoices() {
    // Prevent too frequent updates
    const now = Date.now();
    if (now - lastVoiceUpdate < VOICE_UPDATE_INTERVAL) return;
    lastVoiceUpdate = now;

    const voices = speechSynthesis.getVoices();
    if (!voices || voices.length === 0) {
        console.log('No voices available yet, will retry');
        return false;
    }

    console.log('Voice initialization started');
    console.log('Available voices:', voices.map(v => `${v.name} (${v.lang})`));
    
    // Enhanced male voice detection
    const knownMaleVoices = {
        'en': ['Microsoft David', 'Google UK English Male', 'Daniel', 'Microsoft Mark', 'Microsoft James', 'Fred'],
        'ru': ['Pavel', 'Dmitri', 'Microsoft Pavel', 'Yuri']
    };
    
    const femaleVoicePatterns = [
        /female/i, /woman/i, /girl/i, /alice/i, /anna/i, /mary/i, /victoria/i,
        /milena/i, /elena/i, /julia/i, /maria/i, /sarah/i, /samantha/i, /susan/i,
        /zira/i, /karen/i, /monika/i, /laura/i, /siri/i, /cortana/i
    ];

    function isMaleVoice(voice) {
        const name = voice.name.toLowerCase();
        // Check if it's a known male voice
        if (knownMaleVoices['en'].some(v => voice.name.includes(v))) return true;
        if (knownMaleVoices['ru'].some(v => voice.name.includes(v))) return true;
        // Check if it's definitely not a female voice
        return !femaleVoicePatterns.some(pattern => pattern.test(name));
    }

    function selectVoiceForLanguage(langPrefix) {
        // First try known male voices
        let voice = voices.find(v => 
            v.lang.startsWith(langPrefix) && 
            knownMaleVoices[langPrefix.slice(0,2)].some(name => v.name.includes(name))
        );
        
        // Then try any voice that passes our male voice check
        if (!voice) {
            voice = voices.find(v => 
                v.lang.startsWith(langPrefix) && 
                isMaleVoice(v)
            );
        }
        
        if (voice) {
            console.log(`Selected ${langPrefix} voice: ${voice.name}`);
            return voice;
        }
        
        console.log(`No suitable male voice found for ${langPrefix}`);
        return null;
    }

    // Select voices for both languages
    window.englishVoice = selectVoiceForLanguage('en');
    window.russianVoice = selectVoiceForLanguage('ru');

    if (window.englishVoice || window.russianVoice) {
        isInitialized = true;
        console.log('Voice initialization successful');
        console.log('Voice settings applied: pitch=0.7 (masculine), rate=0.9');
        return true;
    }

    return false;
}

function speakWord(lang) {
    if (!currentWord || !window.speechSynthesis) return;
    
    // Ensure voices are initialized
    if (!isInitialized) {
        console.log('Initializing voices before speaking');
        initializeVoices();
        // Retry after initialization
        setTimeout(() => speakWord(lang), 100);
        return;
    }

    // Cancel any ongoing speech
    speechSynthesis.cancel();

    const text = lang === 'en' ? currentWord.word : currentWord.translation;
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Set language-specific voice
    if (lang === 'en' && window.englishVoice) {
        utterance.voice = window.englishVoice;
        utterance.lang = 'en-US';
        console.log('Using English voice:', window.englishVoice.name);
    } else if (lang === 'ru' && window.russianVoice) {
        utterance.voice = window.russianVoice;
        utterance.lang = 'ru-RU';
        console.log('Using Russian voice:', window.russianVoice.name);
    } else {
        console.log(`No appropriate voice found for ${lang}`);
        return;
    }
    
    // Force masculine voice characteristics
    utterance.pitch = 0.7;
    console.log('Setting masculine voice characteristics: pitch=' + utterance.pitch);
    utterance.rate = 0.9;
    utterance.volume = 1.0;

    // Handle mobile-specific issues
    let timeoutId;
    utterance.onstart = () => {
        console.log('Speech started with pitch=' + utterance.pitch);
        timeoutId = setInterval(() => {
            if (speechSynthesis.paused) {
                speechSynthesis.resume();
            }
        }, 250);
    };
    
    utterance.onend = () => {
        console.log('Speech ended');
        clearInterval(timeoutId);
        speechSynthesis.cancel();
    };
    
    utterance.onerror = (event) => {
        clearInterval(timeoutId);
        console.error('Speech error:', event);
        speechSynthesis.cancel();
        
        // Attempt recovery
        setTimeout(() => {
            initializeVoices();
            speakWord(lang);
        }, 100);
    };

    // Use setTimeout to prevent mobile Safari issues
    setTimeout(() => {
        try {
            speechSynthesis.speak(utterance);
        } catch (error) {
            console.error('Speech synthesis error:', error);
            // Final recovery attempt
            setTimeout(() => speechSynthesis.speak(utterance), 100);
        }
    }, 50);
}

function flipCard() {
    document.querySelector(".card").classList.toggle("flipped");
}

function loadStats() {
    fetch("/stats")
        .then(response => response.json())
        .then(data => {
            document.getElementById("learnedCount").textContent = data.learned_words;
        })
        .catch(error => console.error("Ошибка загрузки статистики:", error));
}

function loadNewWord() {
    fetch('/word')
        .then(response => response.json())
        .then(data => {
            if (data.word === "Все слова изучены!") {
                currentWord = null;
                document.getElementById('word').textContent = data.word;
                document.getElementById('translation').textContent = '';
                document.querySelectorAll('.speak-button').forEach(button => {
                    button.style.visibility = 'hidden';
                });
            } else {
                currentWord = data;
                document.getElementById('word').textContent = data.word;
                document.getElementById('translation').textContent = data.translation;
                document.querySelectorAll('.speak-button').forEach(button => {
                    button.style.visibility = 'visible';
                });
            }
            
            // Always reset card to front side when loading new word
            const card = document.querySelector('.card');
            card.classList.remove('flipped');
            
            updateTotalWords();
            loadStats();
        })
        .catch(error => {
            console.error('Error loading word:', error);
            document.getElementById('word').textContent = 'Ошибка загрузки';
            document.getElementById('translation').textContent = '';
            document.querySelectorAll('.speak-button').forEach(button => {
                button.style.visibility = 'hidden';
            });
        });
}

function showTranslation() {
    document.getElementById('translation').style.display = 'block';
}

function addWord() {
    const word = document.getElementById('newWord').value;
    const translation = document.getElementById('newTranslation').value;

    if (!word || !translation) return;

    fetch('/add', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            word: word,
            translation: translation
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            document.getElementById('newWord').value = '';
            document.getElementById('newTranslation').value = '';
            loadNewWord();
        }
    });
}

function deleteWord() {
    if (!currentWord) return;

    fetch('/delete', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            word: currentWord.word
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            loadNewWord();
            updateTotalWords();
            loadStats();
        }
    });
}

function updateTotalWords() {
    fetch('/total-words')
        .then(response => response.json())
        .then(data => {
            document.getElementById('totalCount').textContent = data.total_words;
        });
}

function showEditModal() {
    if (!currentWord) return;
    
    document.getElementById('editWordInput').value = currentWord.word;
    document.getElementById('editTranslationInput').value = currentWord.translation;
    document.getElementById('editModal').style.display = 'block';
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

function saveEdit() {
    const newWord = document.getElementById('editWordInput').value;
    const newTranslation = document.getElementById('editTranslationInput').value;

    if (!newWord || !newTranslation) return;

    fetch('/update', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            oldWord: currentWord.word,
            newWord: newWord,
            newTranslation: newTranslation
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            closeEditModal();
            loadNewWord();
        }
    });
}

function knowWord() {
    if (!currentWord || currentWord.word === "Все слова изучены!") return;
    
    fetch('/mark_known', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ word: currentWord.word })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            loadNewWord();
            loadStats();
        }
    });
}

function dontKnowWord() {
    if (!currentWord || currentWord.word === "Все слова изучены!") return;
    
    fetch('/increase_progress', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ word: currentWord.word })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            loadNewWord();
            loadStats();
        }
    });
}

function resetProgress() {
    fetch('/reset_progress', {
        method: 'POST',
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            loadNewWord();
            loadStats();
        }
    });
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('editModal');
    if (event.target == modal) {
        closeEditModal();
    }
}
