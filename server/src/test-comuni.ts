import fs from 'fs';
import path from 'path';

// Test if the comuni.json file exists and is readable
const comuniPath = path.join(__dirname, '../data/comuni.json');
console.log('Checking if comuni.json exists at:', comuniPath);

try {
  const fileExists = fs.existsSync(comuniPath);
  console.log('File exists:', fileExists);
  
  if (fileExists) {
    const data = fs.readFileSync(comuniPath, 'utf8');
    const comuni = JSON.parse(data);
    console.log('Successfully parsed comuni.json');
    console.log('Number of comuni:', comuni.length);
    console.log('First 3 comuni:', comuni.slice(0, 3));
  }
} catch (error) {
  console.error('Error reading comuni.json:', error);
}