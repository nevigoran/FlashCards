document.addEventListener("DOMContentLoaded", function() {
    loadNewWord();
    
    // Try to initialize voices immediately and set up a more robust initialization system
    if ('speechSynthesis' in window) {
        // Force load voices
        window.speechSynthesis.getVoices();
        
        // Primary initialization through onvoiceschanged
        if ('onvoiceschanged' in speechSynthesis) {
            speechSynthesis.onvoiceschanged = function() {
                console.log('Voices changed event triggered');
                initializeVoices();
            };
        }
        
        // Backup initialization with retry mechanism
        const maxInitAttempts = 10;
        let initAttempt = 0;
        
        function tryInitialize() {
            if (initAttempt >= maxInitAttempts) {
                console.error('Max voice initialization attempts reached');
                return;
            }
            
            const voices = speechSynthesis.getVoices();
            if (voices && voices.length > 0) {
                console.log(`Found ${voices.length} voices on attempt ${initAttempt + 1}`);
                initializeVoices();
            } else {
                console.log(`No voices available on attempt ${initAttempt + 1}, retrying...`);
                initAttempt++;
                setTimeout(tryInitialize, 500); // Longer delay between attempts
            }
        }
        
        // Start initialization process
        tryInitialize();
    }
    
    // Backup initialization on first interaction
    function initVoicesOnInteraction() {
        if (!window.speechSynthesis) {
            console.error('Speech synthesis not supported');
            return;
        }
        initializeVoices();
        // Remove listeners after initialization
        document.removeEventListener('click', initVoicesOnInteraction);
        document.removeEventListener('touchstart', initVoicesOnInteraction);
    }
    
    document.addEventListener('click', initVoicesOnInteraction);
    document.addEventListener('touchstart', initVoicesOnInteraction);
});

let currentWord = null;
let speechSynthesis = window.speechSynthesis;
let speechUtterance = null;
let selectedVoice = null;
let isInitialized = false;
let initializationAttempts = 0;
const MAX_INIT_ATTEMPTS = 3;

// Initialize voices function with retry mechanism
function initializeVoices() {
    if (initializationAttempts >= MAX_INIT_ATTEMPTS) {
        console.error('Max voice initialization attempts reached');
        return;
    }
    
    if (!isInitialized && 'speechSynthesis' in window) {
        setupVoices();
        initializationAttempts++;
    }
}

function setupVoices() {
    const voices = speechSynthesis.getVoices();
    if (!voices || voices.length === 0) {
        console.log('No voices available in setupVoices, deferring initialization');
        return false;
    }
    
    console.log('Available voices:', voices.map(v => `${v.name} (${v.lang})`));
    
    // Comprehensive list of male voice indicators
    const maleIndicators = [
        'male', 'david', 'james', 'daniel', 'tom', 'alex', 'viktor', 'dmitri',
        'peter', 'paul', 'john', 'mike', 'thomas', 'robert', 'william',
        'mikhail', 'ivan', 'boris', 'george', 'steve', 'guy', 'microsoft david',
        'microsoft mark', 'google male', 'microsoft james'
    ];
    
    // Comprehensive list of female voice indicators to filter out
    const femaleIndicators = [
        'female', 'alice', 'anna', 'mary', 'victoria', 'milena', 'elena', 'julia',
        'maria', 'sarah', 'samantha', 'susan', 'zira', 'karen', 'monika', 'laura',
        'siri', 'cortana', 'google female', 'microsoft zira', 'microsoft anna'
    ];

    function isFemaleVoice(voice) {
        const lowerName = voice.name.toLowerCase();
        return femaleIndicators.some(indicator => lowerName.includes(indicator));
    }

    function isMaleVoice(voice) {
        const lowerName = voice.name.toLowerCase();
        return maleIndicators.some(indicator => lowerName.includes(indicator));
    }

    function findVoiceForLanguage(langPrefix) {
        // First try to find an explicitly male voice
        let voice = voices.find(v => 
            v.lang.startsWith(langPrefix) && isMaleVoice(v)
        );

        if (voice) {
            console.log(`Selected ${langPrefix} male voice:`, voice.name);
        }

        // Then try any non-female voice
        if (!voice) {
            voice = voices.find(v => 
                v.lang.startsWith(langPrefix) && !isFemaleVoice(v)
            );
            if (voice) {
                console.log(`Selected ${langPrefix} non-female voice:`, voice.name);
            }
        }

        return voice;
    }

    // Try to find appropriate voices
    window.englishVoice = findVoiceForLanguage('en');
    window.russianVoice = findVoiceForLanguage('ru');

    if (window.englishVoice || window.russianVoice) {
        isInitialized = true;
        console.log('Voice initialization successful');
        console.log('Selected voices:');
        if (window.englishVoice) {
            console.log('English:', window.englishVoice.name);
        }
        if (window.russianVoice) {
            console.log('Russian:', window.russianVoice.name);
        }
        console.log('Voice settings: pitch=0.7 (masculine), rate=0.9');
        return true;
    } else {
        console.log('No suitable voices found');
        return false;
    }
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

function speakWord(lang) {
    if (!currentWord || currentWord.word === "Все слова изучены!") {
        return;
    }
    
    if (!window.speechSynthesis) {
        console.error('Speech synthesis not supported');
        return;
    }

    // Ensure voices are initialized
    if (!isInitialized) {
        initializeVoices();
        return setTimeout(() => speakWord(lang), 100);
    }

    // Cancel any ongoing speech
    speechSynthesis.cancel();

    const text = lang === 'en' ? currentWord.word : currentWord.translation;
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Set appropriate voice and properties
    if (lang === 'en') {
        utterance.lang = 'en-US';
        if (window.englishVoice) {
            utterance.voice = window.englishVoice;
            console.log('Using English voice:', window.englishVoice.name);
        } else {
            console.log('No suitable English voice available');
            return;
        }
    } else {
        utterance.lang = 'ru-RU';
        if (window.russianVoice) {
            utterance.voice = window.russianVoice;
            console.log('Using Russian voice:', window.russianVoice.name);
        } else {
            console.log('No suitable Russian voice available');
            return;
        }
    }
    
    // Set masculine voice properties
    utterance.rate = 0.9;
    utterance.pitch = 0.7; // Lower pitch for more masculine sound
    utterance.volume = 1.0;
    console.log('Speech settings: pitch=0.7, rate=0.9, volume=1.0');
    
    // Error handling
    utterance.onerror = function(event) {
        console.error('Speech error:', event);
        speechSynthesis.cancel();
        // Try to recover
        if (!event.handled) {
            event.handled = true;
            setTimeout(() => speakWord(lang), 100);
        }
    };
    
    utterance.onend = function() {
        speechSynthesis.cancel();
    };
    
    // Mobile device handling
    utterance.onpause = function() {
        speechSynthesis.resume();
    };
    
    try {
        setTimeout(() => {
            speechSynthesis.speak(utterance);
        }, 50);
    } catch (error) {
        console.error('Speech synthesis error:', error);
        speechSynthesis.cancel();
        // Final recovery attempt
        setTimeout(() => {
            try {
                speechSynthesis.speak(utterance);
            } catch (e) {
                console.error('Final attempt failed:', e);
            }
        }, 100);
    }
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
