# -*- coding: utf-8 -*-
from flask import Flask, request, jsonify, render_template
import sqlite3
import psycopg2
from psycopg2.extras import DictCursor
import random
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# Check if we're running on Render (PostgreSQL) or locally (SQLite)
DATABASE_URL = os.getenv('DATABASE_URL')

def connect_db():
    if DATABASE_URL:  # We're on Render
        try:
            conn = psycopg2.connect(DATABASE_URL, cursor_factory=DictCursor)
            return conn
        except psycopg2.Error as e:
            print("Ошибка подключения к PostgreSQL: {}".format(e))
            raise
    else:  # We're running locally
        try:
            db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "flashcards.db")
            print("Используем локальную базу данных SQLite: {}".format(db_path))
            return sqlite3.connect(db_path)
        except sqlite3.Error as e:
            print("Ошибка подключения к SQLite: {}".format(e))
            raise

def init_db():
    with connect_db() as conn:
        cursor = conn.cursor()
        
        if DATABASE_URL:  # PostgreSQL
            # Check if table exists
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'words'
                )
            """)
            table_exists = cursor.fetchone()[0]
            
            if not table_exists:
                cursor.execute('''
                    CREATE TABLE words (
                        id SERIAL PRIMARY KEY,
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
                cursor.executemany("INSERT INTO words (word, translation, progress) VALUES (%s, %s, 0)", test_words)
                
        else:  # SQLite
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

@app.route("/word", methods=["GET"])
def get_random_word():
    try:
        with connect_db() as conn:
            cursor = conn.cursor()
            if DATABASE_URL:
                cursor.execute("SELECT word, translation FROM words WHERE progress < 5 ORDER BY RANDOM() LIMIT 1")
            else:
                cursor.execute("SELECT word, translation FROM words WHERE progress < 5 ORDER BY RANDOM() LIMIT 1")
            
            word = cursor.fetchone()
            if word:
                if DATABASE_URL:
                    return jsonify({"word": word['word'], "translation": word['translation']})
                else:
                    return jsonify({"word": word[0], "translation": word[1]})
            
            return jsonify({"word": "Все слова изучены!", "translation": ""})
    except (sqlite3.Error, psycopg2.Error) as e:
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
            if DATABASE_URL:
                cursor.execute("UPDATE words SET progress = 5 WHERE word = %s", (word,))
            else:
                cursor.execute("UPDATE words SET progress = 5 WHERE word = ?", (word,))
            conn.commit()
            if cursor.rowcount == 0:
                return jsonify({"error": "Слово не найдено"}), 404
            return jsonify({"success": True, "message": "Слово '{}' отмечено как изученное!".format(word)})
    except (sqlite3.Error, psycopg2.Error) as e:
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
            if DATABASE_URL:
                cursor.execute("UPDATE words SET progress = progress + 1 WHERE word = %s AND progress < 5", (word,))
            else:
                cursor.execute("UPDATE words SET progress = progress + 1 WHERE word = ? AND progress < 5", (word,))
            conn.commit()
            if cursor.rowcount == 0:
                return jsonify({"error": "Слово не найдено или уже изучено"}), 404
            return jsonify({"success": True})
    except (sqlite3.Error, psycopg2.Error) as e:
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

            # Check if word exists
            if DATABASE_URL:
                cursor.execute("SELECT * FROM words WHERE word = %s", (word,))
            else:
                cursor.execute("SELECT * FROM words WHERE word = ?", (word,))
            
            existing_word = cursor.fetchone()
            if existing_word:
                return jsonify({"error": "Слово '{}' уже существует!".format(word)}), 409

            # Add the word
            if DATABASE_URL:
                cursor.execute("INSERT INTO words (word, translation, progress) VALUES (%s, %s, 0)", 
                             (word, translation))
            else:
                cursor.execute("INSERT INTO words (word, translation, progress) VALUES (?, ?, 0)", 
                             (word, translation))
            
            conn.commit()
            return jsonify({"success": True, "message": "Слово добавлено!"})
    except (sqlite3.Error, psycopg2.Error) as e:
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
            if DATABASE_URL:
                cursor.execute("DELETE FROM words WHERE word = %s", (word,))
            else:
                cursor.execute("DELETE FROM words WHERE word = ?", (word,))
            conn.commit()
            if cursor.rowcount == 0:
                return jsonify({"error": "Слово не найдено"}), 404
            return jsonify({"success": True, "message": "Слово '{}' удалено!".format(word)})
    except (sqlite3.Error, psycopg2.Error) as e:
        return jsonify({"error": "Ошибка базы данных"}), 500

@app.route("/reset_progress", methods=["POST"])
def reset_progress():
    try:
        with connect_db() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE words SET progress = 0")
            conn.commit()
            return jsonify({"success": True})
    except (sqlite3.Error, psycopg2.Error) as e:
        return jsonify({"error": "Ошибка базы данных"}), 500

@app.route("/stats", methods=["GET"])
def get_stats():
    try:
        with connect_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM words WHERE progress = 5")
            learned_count = cursor.fetchone()[0]
            return jsonify({"learned_words": learned_count})
    except (sqlite3.Error, psycopg2.Error) as e:
        return jsonify({"error": "Ошибка базы данных"}), 500

@app.route("/total-words", methods=["GET"])
def get_total_words():
    try:
        with connect_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM words")
            total_count = cursor.fetchone()[0]
            return jsonify({"total_words": total_count})
    except (sqlite3.Error, psycopg2.Error) as e:
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
            
            # Check if the new word already exists
            if old_word != new_word:
                if DATABASE_URL:
                    cursor.execute("SELECT * FROM words WHERE word = %s", (new_word,))
                else:
                    cursor.execute("SELECT * FROM words WHERE word = ?", (new_word,))
                if cursor.fetchone():
                    return jsonify({"error": "Слово '{}' уже существует!".format(new_word)}), 409

            if DATABASE_URL:
                cursor.execute("""
                    UPDATE words 
                    SET word = %s, translation = %s
                    WHERE word = %s
                """, (new_word, new_translation, old_word))
            else:
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
                "message": "Слово '{}' обновлено на '{}'!".format(old_word, new_word)
            })
    except (sqlite3.Error, psycopg2.Error) as e:
        return jsonify({"error": "Ошибка базы данных"}), 500

@app.after_request
def add_header(response):
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    return response

if __name__ == "__main__":
    app.run(debug=True)
