#!/usr/bin/env python3
"""
SQLite 到 MySQL 数据迁移脚本
"""
import sqlite3
import hashlib
from urllib.parse import quote_plus

import pymysql


def hash_password(password: str) -> str:
    """密码哈希"""
    return hashlib.sha256(password.encode()).hexdigest()


def migrate_data():
    """迁移数据从 SQLite 到 MySQL"""
    # SQLite 连接
    sqlite_conn = sqlite3.connect('/Users/chenzhihui/Documents/trae_projects/ev_check/ev_check.db')
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cursor = sqlite_conn.cursor()

    # MySQL 连接
    mysql_conn = pymysql.connect(
        host='127.0.0.1',
        port=3306,
        user='root',
        password='Rdserver@2005',
        database='ev_check',
        charset='utf8mb4'
    )
    mysql_cursor = mysql_conn.cursor()

    # 禁用外键检查
    mysql_cursor.execute("SET FOREIGN_KEY_CHECKS = 0")

    migrated_counts = {}

    try:
        # 1. 迁移用户 (跳过已存在的 admin)
        sqlite_cursor.execute("SELECT * FROM users")
        users = sqlite_cursor.fetchall()
        user_count = 0
        for user in users:
            if user['username'] == 'admin':
                continue  # 跳过 admin，已经创建
            try:
                mysql_cursor.execute("""
                    INSERT INTO users (id, username, password_hash, email, is_active, role, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    user['id'], user['username'], user['password_hash'], user['email'],
                    user['is_active'], user['role'], user['created_at'], user['updated_at']
                ))
                user_count += 1
            except pymysql.err.IntegrityError:
                pass  # 已存在，跳过
        migrated_counts['users'] = user_count

        # 2. 迁移通信机组
        sqlite_cursor.execute("SELECT * FROM communication_groups")
        groups = sqlite_cursor.fetchall()
        for group in groups:
            try:
                mysql_cursor.execute("""
                    INSERT INTO communication_groups (id, name, parent_id, description, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (
                    group['id'], group['name'], group['parent_id'], group['description'],
                    group['created_at'], group['updated_at']
                ))
            except pymysql.err.IntegrityError:
                pass
        migrated_counts['communication_groups'] = len(groups)

        # 3. 迁移通信机
        sqlite_cursor.execute("SELECT * FROM communications")
        comms = sqlite_cursor.fetchall()
        for comm in comms:
            try:
                mysql_cursor.execute("""
                    INSERT INTO communications (id, name, ip_address, port, username, password,
                        ssh_key_id, group_id, description, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    comm['id'], comm['name'], comm['ip_address'], comm['port'], comm['username'],
                    comm['password'], comm['ssh_key_id'], comm['group_id'], comm['description'],
                    comm['created_at'], comm['updated_at']
                ))
            except pymysql.err.IntegrityError:
                pass
        migrated_counts['communications'] = len(comms)

        # 4. 迁移检查项列表
        sqlite_cursor.execute("SELECT * FROM check_item_lists")
        lists = sqlite_cursor.fetchall()
        for lst in lists:
            try:
                mysql_cursor.execute("""
                    INSERT INTO check_item_lists (id, name, description, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s)
                """, (lst['id'], lst['name'], lst['description'], lst['created_at'], lst['updated_at']))
            except pymysql.err.IntegrityError:
                pass
        migrated_counts['check_item_lists'] = len(lists)

        # 5. 迁移检查项
        sqlite_cursor.execute("SELECT * FROM check_items")
        items = sqlite_cursor.fetchall()
        for item in items:
            try:
                mysql_cursor.execute("""
                    INSERT INTO check_items (id, name, type, target_path, check_attributes,
                        severity, description, list_id, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    item['id'], item['name'], item['type'], item['target_path'], item['check_attributes'],
                    item['severity'], item['description'], item['list_id'], item['created_at'], item['updated_at']
                ))
            except pymysql.err.IntegrityError:
                pass
        migrated_counts['check_items'] = len(items)

        # 6. 迁移快照组
        sqlite_cursor.execute("SELECT * FROM snapshot_groups")
        snapshot_groups = sqlite_cursor.fetchall()
        for sg in snapshot_groups:
            try:
                mysql_cursor.execute("""
                    INSERT INTO snapshot_groups (id, name, parent_id, check_item_list_id,
                        default_snapshot_id, is_system, description, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    sg['id'], sg['name'], sg['parent_id'], sg['check_item_list_id'],
                    sg['default_snapshot_id'], sg['is_system'], sg['description'],
                    sg['created_at'], sg['updated_at']
                ))
            except pymysql.err.IntegrityError:
                pass
        migrated_counts['snapshot_groups'] = len(snapshot_groups)

        # 7. 迁移快照
        sqlite_cursor.execute("SELECT * FROM snapshots")
        snapshots = sqlite_cursor.fetchall()
        for snap in snapshots:
            try:
                mysql_cursor.execute("""
                    INSERT INTO snapshots (id, group_id, name, snapshot_time, is_default,
                        description, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    snap['id'], snap['group_id'], snap['name'], snap['snapshot_time'],
                    snap['is_default'], snap['description'], snap['created_at'], snap['updated_at']
                ))
            except pymysql.err.IntegrityError:
                pass
        migrated_counts['snapshots'] = len(snapshots)

        # 8. 迁移 SSH 密钥
        sqlite_cursor.execute("SELECT * FROM ssh_keys")
        keys = sqlite_cursor.fetchall()
        for key in keys:
            try:
                mysql_cursor.execute("""
                    INSERT INTO ssh_keys (id, name, key_type, public_key, private_key,
                        passphrase, description, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    key['id'], key['name'], key['key_type'], key['public_key'], key['private_key'],
                    key['passphrase'], key['description'], key['created_at'], key['updated_at']
                ))
            except pymysql.err.IntegrityError:
                pass
        migrated_counts['ssh_keys'] = len(keys)

        mysql_conn.commit()
        print("✅ 数据迁移完成!")
        print("\n迁移统计:")
        for table, count in migrated_counts.items():
            print(f"  - {table}: {count} 条记录")

    except Exception as e:
        mysql_conn.rollback()
        print(f"❌ 迁移失败: {e}")
        raise
    finally:
        mysql_cursor.execute("SET FOREIGN_KEY_CHECKS = 1")
        sqlite_conn.close()
        mysql_conn.close()


if __name__ == "__main__":
    migrate_data()
