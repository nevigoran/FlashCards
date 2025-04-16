# -*- coding: utf-8 -*-
from flask import Flask, request, jsonify, render_template
import sqlite3
import random
import os

app = Flask(__name__)

def connect_db():
    try:
        db_path = os.path.abspath("flashcards.db")
        print("Используем базу данных:", db_path)
        return sqlite3.connect(db_path)
    except sqlite3.Error as e:
        print(f"Ошибка подключения к базе данных: {e}")
        raise

def init_db():
    with connect_db() as conn:
        cursor = conn.cursor()
        
        # Check if table exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='words'
        """)
        table_exists = cursor.fetchone() is not None
        
        if not table_exists:
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS words (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    word TEXT NOT NULL,
                    translation TEXT NOT NULL,
                    progress INTEGER DEFAULT 0
                )
            ''')
            
            # Add test words only when creating the table for the first time
            test_words = [
                ("hello", "привет"),
                ("world", "мир"),
                ("book", "книга")
            ]
            cursor.executemany("INSERT INTO words (word, translation, progress) VALUES (?, ?, 0)", test_words)
            
        conn.commit()

init_db()

@app.route("/")
def index():
    return render_template("index.html")

previous_word = None

@app.route("/word", methods=["GET"])
def get_random_word():
    try:
        with connect_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT word, translation FROM words WHERE progress < 5 ORDER BY RANDOM() LIMIT 1")
            word = cursor.fetchone()

            if word:
                return jsonify({
                    "word": word[0], 
                    "translation": word[1]
                })
            
            return jsonify({"word": "Все слова изучены!", "translation": ""})
    except sqlite3.Error as e:
        return jsonify({"error": "Ошибка базы данных"}), 500

@app.route("/mark_known", methods=["POST"])
def mark_known():
    data = request.json
    word = data.get("word")

    if not word:
        return jsonify({"error": "Не указано слово"}), 400

    try:
        with connect_db() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE words SET progress = 5 WHERE word = ?", (word,))
            conn.commit()
            if cursor.rowcount == 0:
                return jsonify({"error": "Слово не найдено"}), 404
            return jsonify({"success": True, "message": f"Слово '{word}' отмечено как изученное!"})
    except sqlite3.Error as e:
        return jsonify({"error": "Ошибка базы данных"}), 500

@app.route("/increase_progress", methods=["POST"])
def increase_progress():
    data = request.json
    word = data.get("word")

    if not word:
        return jsonify({"error": "Не указано слово"}), 400

    try:
        with connect_db() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE words SET progress = progress + 1 WHERE word = ? AND progress < 5", (word,))
            conn.commit()
            if cursor.rowcount == 0:
                return jsonify({"error": "Слово не найдено или уже изучено"}), 404
            return jsonify({"success": True})
    except sqlite3.Error as e:
        return jsonify({"error": "Ошибка базы данных"}), 500

@app.route("/add", methods=["POST"])
def add_word():
    data = request.json
    word = data.get("word")
    translation = data.get("translation")

    if not word or not translation:
        return jsonify({"error": "Пожалуйста, укажите слово и перевод"}), 400

    try:
        with connect_db() as conn:
            cursor = conn.cursor()

            # Проверяем, есть ли слово в базе
            cursor.execute("SELECT * FROM words WHERE word = ?", (word,))
            existing_word = cursor.fetchone()

            if existing_word:
                return jsonify({"error": f"Слово '{word}' уже существует!"}), 409

            # Добавляем слово, если его нет
            cursor.execute("INSERT INTO words (word, translation, progress) VALUES (?, ?, 0)", 
                         (word, translation))
            conn.commit()
            return jsonify({"success": True, "message": "Слово добавлено!"})
    except sqlite3.Error as e:
        return jsonify({"error": "Ошибка базы данных"}), 500

@app.route("/delete", methods=["POST"])
def delete_word():
    data = request.json
    word = data.get("word")

    if not word:
        return jsonify({"error": "Укажите слово для удаления"}), 400

    try:
        with connect_db() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM words WHERE word = ?", (word,))
            conn.commit()
            if cursor.rowcount == 0:
                return jsonify({"error": "Слово не найдено"}), 404
            return jsonify({"success": True, "message": f"Слово '{word}' удалено!"})
    except sqlite3.Error as e:
        return jsonify({"error": "Ошибка базы данных"}), 500

@app.route("/reset_progress", methods=["POST"])
def reset_progress():
    try:
        with connect_db() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE words SET progress = 0")
            conn.commit()
            return jsonify({"success": True})
    except sqlite3.Error as e:
        return jsonify({"error": "Ошибка базы данных"}), 500

@app.route("/stats", methods=["GET"])
def get_stats():
    try:
        with connect_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM words WHERE progress = 5")
            learned_count = cursor.fetchone()[0]
            return jsonify({"learned_words": learned_count})
    except sqlite3.Error as e:
        return jsonify({"error": "Ошибка базы данных"}), 500

@app.route("/total-words", methods=["GET"])
def get_total_words():
    try:
        with connect_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM words")
            total_count = cursor.fetchone()[0]
            return jsonify({"total_words": total_count})
    except sqlite3.Error as e:
        return jsonify({"error": "Ошибка базы данных"}), 500

@app.route("/debug-db")
def debug_db():
    try:
        with connect_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM words")
            words = cursor.fetchall()
            return jsonify(words)
    except sqlite3.Error as e:
        return jsonify({"error": "Ошибка базы данных"}), 500

@app.route("/update", methods=["POST"])
def update_word():
    data = request.json
    old_word = data.get("oldWord")
    new_word = data.get("newWord")
    new_translation = data.get("newTranslation")

    if not old_word or not new_word or not new_translation:
        return jsonify({"error": "Пожалуйста, укажите слово и перевод"}), 400

    try:
        with connect_db() as conn:
            cursor = conn.cursor()
            
            # Check if the new word already exists (unless it's the same as old word)
            if old_word != new_word:
                cursor.execute("SELECT * FROM words WHERE word = ?", (new_word,))
                if cursor.fetchone():
                    return jsonify({"error": f"Слово '{new_word}' уже существует!"}), 409

            cursor.execute("""
                UPDATE words 
                SET word = ?, translation = ?
                WHERE word = ?
            """, (new_word, new_translation, old_word))
            
            if cursor.rowcount == 0:
                return jsonify({"error": "Слово не найдено"}), 404
                
            conn.commit()
            return jsonify({
                "success": True, 
                "message": f"Слово '{old_word}' обновлено на '{new_word}'!"
            })
    except sqlite3.Error as e:
        return jsonify({"error": "Ошибка базы данных"}), 500

@app.after_request
def add_header(response):
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    return response

if __name__ == "__main__":
    app.run(debug=True)
