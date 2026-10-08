mNEET-Pro Admin complete package.

Copy admin/ into mNEET-Pro/.
Admin access: create admins/{UID} with active:true OR students/{UID} with role:"admin".
Paths: courses/{course}/chapters/{chapter}/topics/{topic}/quizzes/{quiz}/questions/{question}; topic notes are under topics/{topic}/notes; NCERT and PYQ are chapter-level.
Firebase Storage is used for optional PDF/image uploads; URL fields are also supported.
