document.addEventListener("DOMContentLoaded", loadNewWord);

let currentWord = null;

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
            } else {
                currentWord = data;
                document.getElementById('word').textContent = data.word;
                document.getElementById('translation').textContent = data.translation;
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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadNewWord();
    updateTotalWords();
});

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('editModal');
    if (event.target == modal) {
        closeEditModal();
    }
}









