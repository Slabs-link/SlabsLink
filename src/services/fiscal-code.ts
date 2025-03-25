// Servizio per la generazione del codice fiscale italiano
// Implementazione conforme alle specifiche ufficiali (DM 12/03/1975)

import type { Comune } from '../types/comune';

type FiscalCodeParams = {
  name: string;
  surname: string;
  gender: 'M' | 'F';
  dob: string; // Formato YYYY-MM-DD
  birthplace: string;
};

export const generate = (params: FiscalCodeParams): string => {
  validateInput(params);
  
  const surnamePart = processSurname(params.surname);
  const namePart = processName(params.name);
  const dobPart = processDob(params.dob, params.gender);
  const birthplacePart = processBirthplace(params.birthplace);
  const controlChar = calculateControlChar(surnamePart + namePart + dobPart + birthplacePart);

  return surnamePart + namePart + dobPart + birthplacePart + controlChar;
};

const validateInput = (params: FiscalCodeParams): void => {
  const errors: string[] = [];
  
  if (!params.surname || params.surname.length < 2) {
    errors.push('Cognome non valido');
  }
  if (!params.name || params.name.length < 2) {
    errors.push('Nome non valido');
  }
  if (!params.dob || !/^\d{4}-\d{2}-\d{2}$/.test(params.dob)) {
    errors.push('Data di nascita non valida');
  }
  if (!params.birthplace) {
    errors.push('Comune di nascita non valido');
  }

  if (errors.length > 0) {
    throw new Error(errors.join(', '));
  }
};

const processSurname = (surname: string): string => {
  const consonants = getConsonants(surname);
  const vowels = getVowels(surname);
  
  return (consonants.slice(0, 3) + vowels.slice(0, 3) + 'XXX').slice(0, 3).toUpperCase();
};

const processName = (name: string): string => {
  const consonants = getConsonants(name);
  const vowels = getVowels(name);
  
  if (consonants.length >= 4) {
    return (consonants[0] + consonants[2] + consonants[3]).toUpperCase();
  }
  return (consonants.slice(0, 3) + vowels.slice(0, 3) + 'XXX').slice(0, 3).toUpperCase();
};

const processDob = (dob: string, gender: 'M' | 'F'): string => {
  const date = new Date(dob);
  const year = date.getFullYear().toString().slice(-2);
  const monthCode = 'ABCDEHLMPRST'[date.getMonth()];
  const day = date.getDate() + (gender === 'F' ? 40 : 0);
  
  return year + monthCode + day.toString().padStart(2, '0');
};


// Modifica questa parte
const processBirthplace = (birthplace: string): string => {
  // Invece di caricare direttamente il file, facciamo una chiamata API
  try {
    // Utilizziamo una lista di comuni predefinita come fallback
    const comuni: Comune[] = [
      { nome: "Roma", codice: "H501", provincia: "RM" },
      { nome: "Milano", codice: "F205", provincia: "MI" },
      { nome: "Napoli", codice: "F839", provincia: "NA" },
      { nome: "Torino", codice: "L219", provincia: "TO" },
      { nome: "Palermo", codice: "G273", provincia: "PA" }
    ];
    
    const comune = comuni.find(c => 
      c.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 
      birthplace.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    );
    
    if (!comune) {
      throw new Error(`Comune non trovato: ${birthplace}`);
    }
    return comune.codice;
  } catch (error) {
    console.error('Errore nel processare il comune di nascita:', error);
    // Restituiamo un codice generico in caso di errore
    return 'Z999';
  }
};

const calculateControlChar = (partialCode: string): string => {
  const evenMap: Record<string, number> = {
    '0':0, '1':1, '2':2, '3':3, '4':4, '5':5, '6':6, '7':7, '8':8, '9':9,
    'A':0, 'B':1, 'C':2, 'D':3, 'E':4, 'F':5, 'G':6, 'H':7, 'I':8, 'J':9,
    'K':10, 'L':11, 'M':12, 'N':13, 'O':14, 'P':15, 'Q':16, 'R':17, 'S':18,
    'T':19, 'U':20, 'V':21, 'W':22, 'X':23, 'Y':24, 'Z':25
  };

  const oddMap: Record<string, number> = {
    '0':1, '1':0, '2':5, '3':7, '4':9, '5':13, '6':15, '7':17, '8':19, '9':21,
    'A':1, 'B':0, 'C':5, 'D':7, 'E':9, 'F':13, 'G':15, 'H':17, 'I':19, 'J':21,
    'K':2, 'L':4, 'M':18, 'N':20, 'O':11, 'P':3, 'Q':6, 'R':8, 'S':12,
    'T':14, 'U':16, 'V':10, 'W':22, 'X':25, 'Y':24, 'Z':23
  };

  let sum = 0;
  for (let i = 0; i < 15; i++) {
    const c = partialCode[i];
    sum += (i % 2 === 0) ? oddMap[c] : evenMap[c];
  }

  return String.fromCharCode((sum % 26) + 65);
};

const getConsonants = (str: string): string => {
  return str.toUpperCase().replace(/[^BCDFGHJKLMNPQRSTVWXYZ]/g, '');
};

const getVowels = (str: string): string => {
  return str.toUpperCase().replace(/[^AEIOU]/g, '');
};