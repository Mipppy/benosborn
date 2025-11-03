import bcrypt from 'bcrypt';
const password = 'test'; 
const saltRounds = 10;
const hash = await bcrypt.hash(password, saltRounds);
console.log('Hashed password:', hash);