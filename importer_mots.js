// importer_mots.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Credentials from script.js
const SUPABASE_URL = 'https://lkhcemzurtyyaqctdedb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxraGNlbXp1cnR5eWFxY3RkZWRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MTcwMjgsImV4cCI6MjA3NzM5MzAyOH0.-BjUQu7NhRPQGKEyeDHowiWeU2cDgdUqlOeNmdy5Rgc';

const client = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Function to parse the text file ---
function parseMotsFile(filePath) {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const lines = fileContent.split('\n').filter(line => line.includes(' - '));

    const words = lines.map(line => {
        const parts = line.split(' - ');
        if (parts.length < 2) return null;
        
        const french = parts[0].trim();
        const korean = parts.slice(1).join(' - ').trim();

        if (!french || !korean) return null;

        // Simple categorization logic
        let category = 'Général';
        if (french.includes('?')) category = 'Expressions';
        if (french.startsWith('Mon numéro')) category = 'Expressions';
        if (french.toLowerCase().includes('police') || french.toLowerCase().includes('pompiers')) category = 'Lieux';
        if (french.toLowerCase() === 'jolie') category = 'Adjectifs';


        return { korean, french, category, added_by: 'Node.js Script' };
    }).filter(Boolean); // Filter out any null entries

    return words;
}

// --- Main execution function ---
async function main() {
    console.log('🚀 Démarrage du script d\'importation...');

    const motsFilePath = path.resolve('./mots.txt');
    if (!fs.existsSync(motsFilePath)) {
        console.error(`❌ Le fichier ${motsFilePath} n'a pas été trouvé.`);
        return;
    }

    const newWords = parseMotsFile(motsFilePath);
    if (newWords.length === 0) {
        console.log('🤷 Aucun mot valide trouvé dans mots.txt.');
        return;
    }

    console.log(`🔎 ${newWords.length} mots trouvés dans le fichier.`);

    // 1. Fetch existing words
    const { data: existingWordsData, error: fetchError } = await client
        .from('vocabulary')
        .select('korean');

    if (fetchError) {
        console.error('❌ Erreur lors de la récupération du vocabulaire existant:', fetchError.message);
        return;
    }

    const existingKoreanWords = new Set(existingWordsData.map(w => w.korean));
    console.log(`📚 ${existingKoreanWords.size} mots déjà présents dans la base de données.`);

    // 2. Filter out duplicates
    const wordsToAdd = newWords.filter(word => !existingKoreanWords.has(word.korean));
    const wordsSkippedCount = newWords.length - wordsToAdd.length;

    if (wordsSkippedCount > 0) {
        console.log(`ℹ️ ${wordsSkippedCount} mot(s) ignoré(s) car déjà existant(s).`);
    }

    if (wordsToAdd.length === 0) {
        console.log('✅ Aucun nouveau mot à ajouter. La base de données est à jour.');
        return;
    }

    // 3. Insert new words
    console.log(`➕ Ajout de ${wordsToAdd.length} nouveau(x) mot(s)...`);
    const { error: insertError } = await client.from('vocabulary').insert(wordsToAdd);

    if (insertError) {
        console.error('❌ Erreur lors de l\'insertion des nouveaux mots:', insertError.message);
    } else {
        console.log('🎉 Succès ! Les nouveaux mots ont été ajoutés à la base de données.');
    }

    console.log('👋 Script terminé.');
}

main();
