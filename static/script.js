document.addEventListener("DOMContentLoaded", function() {
    loadNewWord();
    
    // Handle both click and touch events for voice initialization
    function initVoicesOnInteraction() {
        if (!window.speechSynthesis) {
            console.error('Speech synthesis not supported');
            return;
        }
        initializeVoices();
        // Remove both listeners after first interaction
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

// Initialize voices function
function initializeVoices() {
    if (!isInitialized && 'speechSynthesis' in window) {
        if ('onvoiceschanged' in speechSynthesis) {
            speechSynthesis.onvoiceschanged = function() {
                setupVoices();
                isInitialized = true;
            };
        } else {
            setupVoices();
            isInitialized = true;
        }
    }
}

function setupVoices() {
    const voices = speechSynthesis.getVoices();
    console.log('Available voices:', voices.map(v => `${v.name} (${v.lang})`));
    
    // Expanded list of male voice indicators
    const maleIndicators = [
        'male', 'david', 'james', 'daniel', 'tom', 'alex', 'viktor', 'dmitri',
        'peter', 'paul', 'john', 'mike', 'thomas', 'robert', 'william',
        'mikhail', 'ivan', 'boris', 'george', 'steve', 'guy'
    ];
    
    // Expanded list of female voice indicators to filter out
    const femaleIndicators = [
        'female', 'microsoft', 'google us', 'alice', 'anna', 'mary', 'victoria',
        'milena', 'elena', 'julia', 'maria', 'sarah', 'samantha', 'susan',
        'zira', 'karen', 'monika', 'laura', 'siri'
    ];

    // Helper function to check if a voice is female
    function isFemaleVoice(voice) {
        const lowerName = voice.name.toLowerCase();
        return femaleIndicators.some(indicator => lowerName.includes(indicator));
    }

    // Helper function to check if a voice is male
    function isMaleVoice(voice) {
        const lowerName = voice.name.toLowerCase();
        return maleIndicators.some(indicator => lowerName.includes(indicator));
    }

    // Helper function to find a male voice for a specific language
    function findMaleVoice(langPrefix) {
        // First try to find an explicitly male voice
        let voice = voices.find(voice => 
            voice.lang.startsWith(langPrefix) && isMaleVoice(voice)
        );

        // If no explicit male voice found, use any non-female voice
        if (!voice) {
            voice = voices.find(voice => 
                voice.lang.startsWith(langPrefix) && 
                !isFemaleVoice(voice) &&
                !voice.name.toLowerCase().includes('google') // Avoid generic Google voices
            );
        }

        // If still no voice found, try any non-female voice including Google
        if (!voice) {
            voice = voices.find(voice => 
                voice.lang.startsWith(langPrefix) && 
                !isFemaleVoice(voice)
            );
        }

        return voice;
    }

    // Try to find male voices for both English and Russian
    const maleEnglishVoice = findMaleVoice('en');
    const maleRussianVoice = findMaleVoice('ru');

    // Store both voices
    window.englishVoice = maleEnglishVoice;
    window.russianVoice = maleRussianVoice;

    // For backward compatibility
    selectedVoice = window.englishVoice;

    if (selectedVoice) {
        console.log('Selected English voice:', window.englishVoice?.name);
        console.log('Selected Russian voice:', window.russianVoice?.name);
        speechUtterance = new SpeechSynthesisUtterance();
        speechUtterance.rate = 0.9;
        speechUtterance.pitch = 0.75; // Even lower pitch to ensure masculine sound
        speechUtterance.volume = 1.0;
    } else {
        console.log('No voices found - will try using default voice');
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
    
    // Check for browser support
    if (!window.speechSynthesis) {
        console.error('Speech synthesis not supported in this browser');
        return;
    }

    // Force voices to initialize if not done
    if (!isInitialized) {
        initializeVoices();
        // Wait a moment for voices to load on mobile
        return setTimeout(() => speakWord(lang), 100);
    }

    // Force stop any ongoing speech
    speechSynthesis.cancel();

    // Create a new utterance with the appropriate text
    const text = lang === 'en' ? currentWord.word : currentWord.translation;
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Set language and voice based on the language
    if (lang === 'en') {
        utterance.lang = 'en-US';
        if (window.englishVoice) {
            utterance.voice = window.englishVoice;
        } else {
            console.log('No male English voice available');
            return; // Don't speak if no male voice available
        }
    } else {
        utterance.lang = 'ru-RU';
        if (window.russianVoice) {
            utterance.voice = window.russianVoice;
        } else {
            console.log('No male Russian voice available');
            return; // Don't speak if no male voice available
        }
    }
    
    // Set speech properties for masculine sound
    utterance.rate = 0.9;
    utterance.pitch = 0.75; // Lower pitch for more masculine sound
    utterance.volume = 1.0;
    
    // Error handling with retry logic
    utterance.onerror = function(event) {
        console.error('Speech synthesis error:', event);
        speechSynthesis.cancel();
        // Try to reinitialize voices and retry once
        if (!event.handled) {
            event.handled = true;
            initializeVoices();
            setTimeout(() => speakWord(lang), 100);
        }
    };
    
    utterance.onend = function() {
        console.log('Speech finished successfully');
        speechSynthesis.cancel(); // Ensure cleanup after speech
    };
    
    // Handle mobile device specific issues
    utterance.onpause = function() {
        console.log('Speech paused, attempting to resume');
        speechSynthesis.resume();
    };
    
    try {
        // Add a small delay for mobile devices
        setTimeout(() => {
            if (window.englishVoice || window.russianVoice) {
                speechSynthesis.speak(utterance);
            }
        }, 50);
    } catch (error) {
        console.error('Error during speech synthesis:', error);
        speechSynthesis.cancel();
        // Try to recover once
        setTimeout(() => {
            try {
                if (window.englishVoice || window.russianVoice) {
                    speechSynthesis.speak(utterance);
                }
            } catch (e) {
                console.error('Final recovery attempt failed:', e);
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
