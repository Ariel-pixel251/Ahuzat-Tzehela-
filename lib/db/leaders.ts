import type { Db } from "./types";

export type Leader = { id: string; name: string; phone: string | null; email: string | null; project: string };
export type TaskStatus = "todo" | "doing" | "done";
export type Task = {
  id: string;
  leader_id: string | null;
  leader_name: string | null;
  project: string;
  title: string;
  status: TaskStatus;
  due_on: string | null;
};

export const listLeaders = (db: Db) =>
  db.query<Leader>(`select id, name, phone, email, project from leaders order by project, name`);

export const addLeader = (db: Db, l: Omit<Leader, "id">) =>
  db.query(`insert into leaders (name, phone, email, project) values ($1, $2, $3, $4)`, [l.name, l.phone, l.email, l.project]);

export const deleteLeader = (db: Db, id: string) => db.query(`delete from leaders where id = $1`, [id]);

export const listTasks = (db: Db) =>
  db.query<Task>(
    `select t.id, t.leader_id, l.name as leader_name, t.project, t.title, t.status, to_char(t.due_on, 'YYYY-MM-DD') as due_on
       from leader_tasks t left join leaders l on l.id = t.leader_id
      order by t.status = 'done', t.due_on nulls last, t.created_at`,
  );

export const addTask = (db: Db, t: { leader_id: string | null; project: string; title: string; due_on: string | null }) =>
  db.query(`insert into leader_tasks (leader_id, project, title, due_on) values ($1, $2, $3, $4)`, [
    t.leader_id,
    t.project,
    t.title,
    t.due_on,
  ]);

export const setTaskStatus = (db: Db, id: string, status: TaskStatus) =>
  db.query(`update leader_tasks set status = $2 where id = $1`, [id, status]);

export const deleteTask = (db: Db, id: string) => db.query(`delete from leader_tasks where id = $1`, [id]);
