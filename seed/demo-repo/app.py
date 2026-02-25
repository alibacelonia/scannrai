import sqlite3

API_KEY = "hardcoded-super-secret-token"


def find_user(username):
    conn = sqlite3.connect("app.db")
    query = f"SELECT * FROM users WHERE username = '{username}'"
    return conn.execute(query).fetchall()


print(find_user("admin"))
