import os
import tempfile
import pytest
from app import app, init_db

def get_test_database_url():
    """Get database URL for testing"""
    if os.getenv('DATABASE_URL'):
        # If we're on Render, use a test database
        # Format: postgresql://username:password@host:port/database
        db_url = os.getenv('DATABASE_URL')
        # Create a test database URL by appending _test to the database name
        if 'postgres://' in db_url:
            base, rest = db_url.split('postgres://')
            return f'postgres://test_{rest}'
        else:
            base, rest = db_url.split('postgresql://')
            return f'postgresql://test_{rest}'
    return None

@pytest.fixture
def client():
    app.config['TESTING'] = True
    
    # Check if we're running on Render (with PostgreSQL)
    test_db_url = get_test_database_url()
    if test_db_url:
        # We're on Render, use PostgreSQL test database
        original_url = os.getenv('DATABASE_URL')
        os.environ['DATABASE_URL'] = test_db_url
        
        with app.test_client() as client:
            with app.app_context():
                try:
                    init_db()  # Initialize test database
                    yield client
                finally:
                    # Clean up test database
                    if 'psycopg2' not in globals():
                        import psycopg2
                    with psycopg2.connect(test_db_url) as conn:
                        conn.autocommit = True
                        with conn.cursor() as cur:
                            cur.execute("DROP TABLE IF EXISTS words")
                    # Restore original database URL
                    os.environ['DATABASE_URL'] = original_url
    else:
        # We're running locally, use SQLite
        db_fd, db_path = tempfile.mkstemp()
        os.environ['DATABASE_URL'] = ''
        
        with app.test_client() as client:
            with app.app_context():
                try:
                    os.remove("flashcards.db")
                except OSError:
                    pass
                init_db()
                yield client
        
        os.close(db_fd)
        os.unlink(db_path)
        try:
            os.remove("flashcards.db")
        except OSError:
            pass

# Test cases remain the same as they are database-agnostic
def test_index(client):
    """Test that the index page loads correctly"""
    rv = client.get('/')
    assert rv.status_code == 200
    assert b'FlashCards' in rv.data

def test_add_word(client):
    """Test adding a new word"""
    # Add a new word
    rv = client.post('/add', json={
        'word': 'test',
        'translation': 'тест'
    })
    assert rv.status_code == 200
    json_data = rv.get_json()
    assert json_data['success'] == True
    
    # Try adding the same word again
    rv = client.post('/add', json={
        'word': 'test',
        'translation': 'тест'
    })
    assert rv.status_code == 409  # Conflict - word already exists

def test_get_word(client):
    """Test getting a random word"""
    # First add a word
    client.post('/add', json={
        'word': 'apple',
        'translation': 'яблоко'
    })
    
    # Get a random word
    rv = client.get('/word')
    assert rv.status_code == 200
    json_data = rv.get_json()
    assert 'word' in json_data
    assert 'translation' in json_data

def test_mark_known(client):
    """Test marking a word as known"""
    # Add a word first
    client.post('/add', json={
        'word': 'cat',
        'translation': 'кошка'
    })
    
    # Mark it as known
    rv = client.post('/mark_known', json={'word': 'cat'})
    assert rv.status_code == 200
    json_data = rv.get_json()
    assert json_data['success'] == True

def test_delete_word(client):
    """Test deleting a word"""
    # Add a word first
    client.post('/add', json={
        'word': 'delete_me',
        'translation': 'удали_меня'
    })
    
    # Delete the word
    rv = client.post('/delete', json={'word': 'delete_me'})
    assert rv.status_code == 200
    json_data = rv.get_json()
    assert json_data['success'] == True
    
    # Try to delete it again
    rv = client.post('/delete', json={'word': 'delete_me'})
    assert rv.status_code == 404  # Not found

def test_update_word(client):
    """Test updating a word"""
    # Add a word first
    client.post('/add', json={
        'word': 'old',
        'translation': 'старый'
    })
    
    # Update the word
    rv = client.post('/update', json={
        'oldWord': 'old',
        'newWord': 'new',
        'newTranslation': 'новый'
    })
    assert rv.status_code == 200
    json_data = rv.get_json()
    assert json_data['success'] == True

def test_stats(client):
    """Test statistics endpoint"""
    # Add a known word first
    client.post('/add', json={
        'word': 'known_word',
        'translation': 'изученное_слово'
    })
    client.post('/mark_known', json={'word': 'known_word'})
    
    rv = client.get('/stats')
    assert rv.status_code == 200
    json_data = rv.get_json()
    assert 'learned_words' in json_data
    assert json_data['learned_words'] == 1

def test_total_words(client):
    """Test total words count endpoint"""
    # Add a test word
    client.post('/add', json={
        'word': 'count_me',
        'translation': 'посчитай_меня'
    })
    
    rv = client.get('/total-words')
    assert rv.status_code == 200
    json_data = rv.get_json()
    assert 'total_words' in json_data
    assert json_data['total_words'] >= 1

def test_reset_progress(client):
    """Test resetting progress"""
    # Add a word and mark it as known
    client.post('/add', json={
        'word': 'reset_me',
        'translation': 'сбрось_меня'
    })
    client.post('/mark_known', json={'word': 'reset_me'})
    
    # Reset progress
    rv = client.post('/reset_progress')
    assert rv.status_code == 200
    json_data = rv.get_json()
    assert json_data['success'] == True
    
    # Verify the word's progress was reset
    rv = client.get('/stats')
    json_data = rv.get_json()
    assert json_data['learned_words'] == 0

def test_invalid_requests(client):
    """Test handling of invalid requests"""
    # Test adding word without required fields
    rv = client.post('/add', json={})
    assert rv.status_code == 400
    
    # Test marking non-existent word as known
    rv = client.post('/mark_known', json={'word': 'nonexistent'})
    assert rv.status_code == 404
    
    # Test updating non-existent word
    rv = client.post('/update', json={
        'oldWord': 'nonexistent',
        'newWord': 'new',
        'newTranslation': 'новый'
    })
    assert rv.status_code == 404

def test_database_connection(client):
    """Test database connection and type"""
    if os.getenv('DATABASE_URL'):
        assert 'postgresql' in os.getenv('DATABASE_URL').lower()
    else:
        # Check if we're using SQLite locally
        assert os.path.exists('flashcards.db')