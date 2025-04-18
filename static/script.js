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
    
    // Common male voice indicators
    const maleIndicators = ['male', 'david', 'james', 'daniel', 'tom', 'alex', 'viktor', 'dmitri'];

    // Helper function to find a male voice for a specific language
    function findMaleVoice(langPrefix) {
        return voices.find(voice => 
            voice.lang.startsWith(langPrefix) && 
            maleIndicators.some(indicator => 
                voice.name.toLowerCase().includes(indicator)
            )
        );
    }

    // Try to find male voices for both English and Russian
    const maleEnglishVoice = findMaleVoice('en');
    const maleRussianVoice = findMaleVoice('ru');

    // Store both voices
    window.englishVoice = maleEnglishVoice || voices.find(voice => voice.lang.startsWith('en'));
    window.russianVoice = maleRussianVoice || voices.find(voice => voice.lang.startsWith('ru'));

    // For backward compatibility
    selectedVoice = window.englishVoice;

    if (selectedVoice) {
        console.log('Selected English voice:', window.englishVoice?.name);
        console.log('Selected Russian voice:', window.russianVoice?.name);
        speechUtterance = new SpeechSynthesisUtterance();
        speechUtterance.rate = 0.9;
        speechUtterance.pitch = 1.0;
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

    // Ensure speech synthesis is initialized
    if (!isInitialized) {
        initializeVoices();
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
        }
    } else {
        utterance.lang = 'ru-RU';
        if (window.russianVoice) {
            utterance.voice = window.russianVoice;
        }
    }
    
    // Set speech properties - slightly lower pitch to ensure more masculine sound
    utterance.rate = 0.9;
    utterance.pitch = 0.9;  // Lowered pitch slightly
    utterance.volume = 1.0;
    
    // Comprehensive error handling
    utterance.onerror = function(event) {
        console.error('Speech synthesis error:', event);
        // Try to recover
        speechSynthesis.cancel();
        setTimeout(() => {
            try {
                speechSynthesis.speak(utterance);
            } catch (error) {
                console.error('Recovery attempt failed:', error);
            }
        }, 100);
    };
    
    utterance.onend = function() {
        console.log('Speech finished successfully');
    };
    
    utterance.onpause = function() {
        console.log('Speech paused, attempting to resume');
        speechSynthesis.resume();
    };
    
    try {
        setTimeout(() => {
            speechSynthesis.speak(utterance);
        }, 50);
    } catch (error) {
        console.error('Error during speech synthesis:', error);
        speechSynthesis.cancel();
        setTimeout(() => {
            try {
                speechSynthesis.speak(utterance);
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
