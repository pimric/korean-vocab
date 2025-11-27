// importer_mots_v2.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Credentials from script.js
const SUPABASE_URL = 'https://lkhcemzurtyyaqctdedb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxraGNlbXp1cnR5eWFxY3RkZWRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MTcwMjgsImV4cCI6MjA3NzM5MzAyOH0.-BjUQu7NhRPQGKEyeDHowiWeU2cDgdUqlOeNmdy5Rgc';

const client = createClient(SUPABASE_URL, SUPABASE_KEY);

// Mapping des catégories basé sur les commentaires dans le fichier
const categoryMap = {
    'NOMBRES NATIFS CORÉENS': 'Nombres',
    'NOMBRES SINO-CORÉENS': 'Nombres',
    'TEMPS (MOIS, JOURS, DATE)': 'Temps',
    'SAISONS': 'Général',
    'EXPRESSIONS': 'Expressions',
    'VERBES': 'Verbes',
    'CONJUGAISON - Verbes irréguliers en ㅡ': 'Conjugaison',
    'CONJUGAISON - Verbes irréguliers en ㄹ': 'Conjugaison',
    'CONJUGAISON - Verbes en ㄱ': 'Conjugaison',
    'LIEUX': 'Lieux',
    'PRÉPOSITIONS DE LIEU': 'Grammaire',
    'OBJETS': 'Général',
    'PERSONNES': 'Général',
    'TRANSPORTS': 'Général',
    'NOURRITURE': 'Nourriture',
    'CULTURE': 'Général',
    'ANIMAUX': 'Général',
    'COMPTEURS': 'Grammaire',
    'GRAMMAIRE': 'Grammaire',
    'ADJECTIFS': 'Adjectifs',
    'EXPRESSIONS TEMPORELLES': 'Expressions'
};

// --- Function to parse the text file with categories ---
function parseMotsFile(filePath) {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const lines = fileContent.split('\n');
    
    let currentCategory = 'Général';
    const words = [];

    for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Skip empty lines and title
        if (!trimmedLine || trimmedLine.startsWith('Vocabulaire')) continue;
        
        // Check if it's a category header (starts with #)
        if (trimmedLine.startsWith('#')) {
            const categoryName = trimmedLine.replace('#', '').trim();
            currentCategory = categoryMap[categoryName] || 'Général';
            continue;
        }
        
        // Parse word entry (format: korean - french)
        if (trimmedLine.includes(' - ')) {
            const parts = trimmedLine.split(' - ');
            if (parts.length < 2) continue;
            
            const korean = parts[0].trim();
            const french = parts.slice(1).join(' - ').trim();
            
            if (!korean || !french) continue;
            
            words.push({
                korean,
                french,
                category: currentCategory,
                added_by: 'Import Chapitres 1-3'
            });
        }
    }
    
    return words;
}

// --- Main execution function ---
async function main() {
    console.log('🚀 Démarrage du script d\'importation v2...');
    
    const motsFilePath = path.resolve('./mots_chapitres_1-3.txt');
    if (!fs.existsSync(motsFilePath)) {
        console.error(`❌ Le fichier ${motsFilePath} n'a pas été trouvé.`);
        return;
    }
    
    const newWords = parseMotsFile(motsFilePath);
    if (newWords.length === 0) {
        console.log('🤷 Aucun mot valide trouvé dans mots_chapitres_1-3.txt.');
        return;
    }
    
    console.log(`📖 ${newWords.length} mots trouvés dans le fichier.`);
    
    // Show category distribution
    const categoryCount = {};
    newWords.forEach(w => {
        categoryCount[w.category] = (categoryCount[w.category] || 0) + 1;
    });
    console.log('\n📊 Répartition par catégorie:');
    Object.entries(categoryCount).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
        console.log(`   ${cat}: ${count} mots`);
    });
    
    // 1. Fetch existing words
    const { data: existingWordsData, error: fetchError } = await client
        .from('vocabulary')
        .select('korean');
    
    if (fetchError) {
        console.error('❌ Erreur lors de la récupération du vocabulaire existant:', fetchError.message);
        return;
    }
    
    const existingKoreanWords = new Set(existingWordsData.map(w => w.korean));
    console.log(`\n📚 ${existingKoreanWords.size} mots déjà présents dans la base de données.`);
    
    // 2. Filter out duplicates
    const wordsToAdd = newWords.filter(word => !existingKoreanWords.has(word.korean));
    const wordsSkippedCount = newWords.length - wordsToAdd.length;
    
    if (wordsSkippedCount > 0) {
        console.log(`ℹ️  ${wordsSkippedCount} mot(s) ignoré(s) car déjà existant(s).`);
    }
    
    if (wordsToAdd.length === 0) {
        console.log('✅ Aucun nouveau mot à ajouter. La base de données est à jour.');
        return;
    }
    
    // 3. Insert new words
    console.log(`\n➕ Ajout de ${wordsToAdd.length} nouveau(x) mot(s)...`);
    const { error: insertError } = await client.from('vocabulary').insert(wordsToAdd);
    
    if (insertError) {
        console.error('❌ Erreur lors de l\'insertion des nouveaux mots:', insertError.message);
    } else {
        console.log('🎉 Succès ! Les nouveaux mots ont été ajoutés à la base de données.');
        
        // Show what was added
        const addedCategoryCount = {};
        wordsToAdd.forEach(w => {
            addedCategoryCount[w.category] = (addedCategoryCount[w.category] || 0) + 1;
        });
        console.log('\n✨ Mots ajoutés par catégorie:');
        Object.entries(addedCategoryCount).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
            console.log(`   ${cat}: ${count} mots`);
        });
    }
    
    console.log('\n👋 Script terminé.');
}

main();