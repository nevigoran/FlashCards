document.addEventListener("DOMContentLoaded", loadNewWord);

let currentWord = null;
let speechSynthesis = window.speechSynthesis;
let speechUtterance = null;
let selectedVoice = null;

// Initialize voices function
function initializeVoices() {
    const voices = speechSynthesis.getVoices();
    console.log('Available voices:', voices.map(v => `${v.name} (${v.lang})`));
    
    // Try different male voice types in order of preference
    selectedVoice = voices.find(voice => {
        const isMaleVoice = 
            voice.name.toLowerCase().includes('male') ||
            ['daniel', 'tom', 'alex', 'guy', 'james', 'john'].some(name => 
                voice.name.toLowerCase().includes(name.toLowerCase())
            );
        
        const isUnwantedVoice = 
            voice.name.toLowerCase().includes('female') ||
            voice.name.toLowerCase().includes('samantha') ||
            voice.name.toLowerCase().includes('victoria') ||
            voice.name.toLowerCase().includes('karen') ||
            voice.name.includes('Zira') ||
            voice.name.includes('Microsoft') ||
            voice.name.includes('Cortana');
            
        // Log voice evaluation
        console.log(`Evaluating voice: ${voice.name} - Male: ${isMaleVoice}, Unwanted: ${isUnwantedVoice}`);
            
        return voice.lang.startsWith('en') && isMaleVoice && !isUnwantedVoice;
    });

    // If no specific male voice found, try to find any non-female English voice
    if (!selectedVoice) {
        selectedVoice = voices.find(voice => 
            voice.lang.startsWith('en') && 
            !voice.name.toLowerCase().includes('female') &&
            !voice.name.toLowerCase().includes('samantha') &&
            !voice.name.toLowerCase().includes('victoria') &&
            !voice.name.toLowerCase().includes('karen') &&
            !voice.name.includes('Zira') &&
            !voice.name.includes('Microsoft') &&
            !voice.name.includes('Cortana')
        );
    }
    
    if (selectedVoice) {
        console.log('Selected voice:', selectedVoice.name);
        speechUtterance = new SpeechSynthesisUtterance();
        speechUtterance.voice = selectedVoice;
        speechUtterance.rate = 0.9;     // Slightly slower for clarity
        speechUtterance.pitch = 0.85;   // Lower pitch to ensure male voice
        speechUtterance.volume = 1.0;   // Full volume
    } else {
        console.log('No suitable male voice found');
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
    if (!currentWord || currentWord.word === "Все слова изучены!") return;
    
    // Cancel any ongoing speech
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }

    // Create a new utterance with the appropriate text and language
    const text = lang === 'en' ? currentWord.word : currentWord.translation;
    speechUtterance = new SpeechSynthesisUtterance(text);
    
    // Set language and voice properties
    speechUtterance.lang = lang === 'en' ? 'en-US' : 'ru-RU';
    
    if (lang === 'en' && selectedVoice) {
        speechUtterance.voice = selectedVoice;
        // Optimize parameters for more natural male voice
        speechUtterance.rate = 0.9;     // Slightly slower for clarity
        speechUtterance.pitch = 1.0;    // Natural pitch
        speechUtterance.volume = 1.0;   // Full volume
    }
    
    // Handle errors
    speechUtterance.onerror = function(event) {
        console.error('Speech synthesis error:', event);
        // Try reinitializing voices on error
        initializeVoices();
    };
    
    // Speak the word
    speechSynthesis.speak(speechUtterance);
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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadNewWord();
    updateTotalWords();

    // Initialize voices
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = () => {
            initializeVoices();
        };
    }
    
    // Try to initialize voices immediately in case they're already loaded
    initializeVoices();
});

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('editModal');
    if (event.target == modal) {
        closeEditModal();
    }
}









