import express from 'express';
import comuni from '../../data/comuni.json';

interface Comune {
  nome: string;
  codice: string;
  provincia?: string;
}

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const search = (req.query.search as string || '').trim().toLowerCase();
    
    const results = comuni.filter((c: Comune) => 
      c.nome.toLowerCase().includes(search) ||
      (c.provincia?.toLowerCase() || '').includes(search)
    );

    res.json(results.slice(0, 100));
  } catch (error) {
    console.error('Errore endpoint comuni:', error);
    res.status(500).json({ error: 'Errore nel recupero dei comuni' });
  }
});

export default router;