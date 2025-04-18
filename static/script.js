document.addEventListener("DOMContentLoaded", function() {
    loadNewWord();
    
    function initVoicesOnInteraction() {
        if (!window.speechSynthesis) {
            console.error("Speech synthesis not supported");
            return;
        }
        initializeVoices();
        document.removeEventListener("click", initVoicesOnInteraction);
        document.removeEventListener("touchstart", initVoicesOnInteraction);
    }
    
    document.addEventListener("click", initVoicesOnInteraction);
    document.addEventListener("touchstart", initVoicesOnInteraction);
});

let currentWord = null;
let speechSynthesis = window.speechSynthesis;
let speechUtterance = null;
let selectedVoice = null;
let isInitialized = false;

function setupVoices() {
    let voices = speechSynthesis.getVoices();
    console.log("Available voices:", voices.map(v => `${v.name} (${v.lang})`));

    selectedVoice = voices.find(voice =>
        (voice.name.includes("Male") || voice.name.includes("David") || voice.name.includes("Google UK English Male"))
        && voice.lang.startsWith("en")
    );

    if (!selectedVoice) {
        console.log("Мужской голос не найден, выбираем первый английский");
        selectedVoice = voices.find(voice => voice.lang.startsWith("en"));
    }

    if (selectedVoice) {
        console.log("Selected voice:", selectedVoice.name);
        speechUtterance = new SpeechSynthesisUtterance();
        speechUtterance.voice = selectedVoice;
        speechUtterance.rate = 0.9;
        speechUtterance.pitch = 1.0;
        speechUtterance.volume = 1.0;
    } else {
        console.log("No suitable voice found.");
    }
}

window.speechSynthesis.onvoiceschanged = function() {
    setupVoices();
};

function speakWord(lang) {
    if (!currentWord || currentWord.word === "Все слова изучены!") {
        return;
    }
    
    if (!window.speechSynthesis) {
        console.error("Speech synthesis not supported in this browser");
        return;
    }

    if (!isInitialized) {
        initializeVoices();
    }

    speechSynthesis.cancel();

    const text = lang === "en" ? currentWord.word : currentWord.translation;
    const utterance = new SpeechSynthesisUtterance(text);
    
    utterance.lang = lang === "en" ? "en-US" : "ru-RU";

    if (lang === "en" && selectedVoice) {
        utterance.voice = selectedVoice;
    }

    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onerror = function(event) {
        console.error("Speech synthesis error:", event);
        speechSynthesis.cancel();
        setTimeout(() => {
            try {
                speechSynthesis.speak(utterance);
            } catch (error) {
                console.error("Recovery attempt failed:", error);
            }
        }, 100);
    };
    
    utterance.onend = function() {
        console.log("Speech finished successfully");
    };

    utterance.onpause = function() {
        console.log("Speech paused, attempting to resume");
        speechSynthesis.resume();
    };

    try {
        setTimeout(() => {
            speechSynthesis.speak(utterance);
        }, 50);
    } catch (error) {
        console.error("Error during speech synthesis:", error);
        speechSynthesis.cancel();
        setTimeout(() => {
            try {
                speechSynthesis.speak(utterance);
            } catch (e) {
                console.error("Final recovery attempt failed:", e);
            }
        }, 100);
    }
}

function loadNewWord() {
    fetch("/word")
        .then(response => response.json())
        .then(data => {
            console.log("Полученное слово:", data);

            if (!data.word || data.word === "Все слова изучены!") {
                currentWord = null;
                document.getElementById("word").textContent = "🎉 Все слова изучены!";
                document.getElementById("translation").textContent = "Нажми 'Начать сначала' для повторения!";
                document.querySelectorAll(".speak-button").forEach(button => {
                    button.style.visibility = "hidden";
                });
            } else {
                currentWord = data;
                document.getElementById("word").textContent = data.word;
                document.getElementById("translation").textContent = data.translation;
                document.querySelectorAll(".speak-button").forEach(button => {
                    button.style.visibility = "visible";
                });
            }

            const card = document.querySelector(".card");
            card.classList.remove("flipped");

            updateTotalWords();
            loadStats();
        })
        .catch(error => {
            console.error("Ошибка загрузки слова:", error);
            document.getElementById("word").textContent = "Ошибка загрузки";
            document.getElementById("translation").textContent = "";
            document.querySelectorAll(".speak-button").forEach(button => {
                button.style.visibility = "hidden";
            });
        });
}

function deleteWord() {
    if (!currentWord) return;

    fetch("/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: currentWord.word })
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
    fetch("/total-words")
        .then(response => response.json())
        .then(data => {
            document.getElementById("totalCount").textContent = data.total_words;
        });
}

function toggleEditModal(show) {
    document.getElementById("editModal").style.display = show ? "block" : "none";
}

function saveEdit() {
    const newWord = document.getElementById("editWordInput").value;
    const newTranslation = document.getElementById("editTranslationInput").value;

    if (!newWord || !newTranslation) return;

    fetch("/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            oldWord: currentWord.word,
            newWord: newWord,
            newTranslation: newTranslation
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            toggleEditModal(false);
            loadNewWord();
        }
    });
}

function knowWord() {
    if (!currentWord || currentWord.word === "Все слова изучены!") return;
    
    fetch("/mark_known", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    
    fetch("/increase_progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    fetch("/reset_progress", { method: "POST" })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            loadNewWord();
            loadStats();
        }
    });
}

window.onclick = function(event) {
    const modal = document.getElementById("editModal");
    if (event.target == modal) {
        toggleEditModal(false);
    }
};
