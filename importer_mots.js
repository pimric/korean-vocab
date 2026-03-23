// importer_mots.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Credentials
const SUPABASE_URL = 'https://lkhcemzurtyyaqctdedb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxraGNlbXp1cnR5eWFxY3RkZWRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MTcwMjgsImV4cCI6MjA3NzM5MzAyOH0.-BjUQu7NhRPQGKEyeDHowiWeU2cDgdUqlOeNmdy5Rgc';

const client = createClient(SUPABASE_URL, SUPABASE_KEY);

function isKorean(text) {
    // Regex for Hangul characters
    return /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f\ua960-\ua97f\ud7b0-\ud7ff]/.test(text);
}

// --- Function to parse the text file ---
function parseMotsFile(filePath) {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const lines = fileContent.split('\n');

    const words = [];
    let currentCategory = 'Général';

    for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        // Detect category from headers starting with #
        if (line.startsWith('#')) {
            // Clean up header text (remove # and trim)
            let categoryCandidate = line.replace(/^#+\s*/, '').trim();
            if (categoryCandidate) {
                // Remove anything after ' - ' in category candidate if it exists
                if (categoryCandidate.includes(' - ')) {
                    categoryCandidate = categoryCandidate.split(' - ')[0].trim();
                }

                currentCategory = categoryCandidate.charAt(0).toUpperCase() + categoryCandidate.slice(1).toLowerCase();
                
                // Normalization of some common categories
                if (currentCategory.includes('Nombre')) currentCategory = 'Nombres';
                if (currentCategory.includes('Expression')) currentCategory = 'Expressions';
                if (currentCategory.includes('Verbe')) currentCategory = 'Verbes';
                if (currentCategory.includes('Lieu')) currentCategory = 'Lieux';
                if (currentCategory.includes('Objet')) currentCategory = 'Objets';
                if (currentCategory.includes('Personne')) currentCategory = 'Personnes';
                if (currentCategory.includes('Transport')) currentCategory = 'Transports';
                if (currentCategory.includes('Nourriture')) currentCategory = 'Nourriture';
                if (currentCategory.includes('Animal')) currentCategory = 'Animaux';
                if (currentCategory.includes('Compteur')) currentCategory = 'Compteurs';
                if (currentCategory.includes('Grammaire')) currentCategory = 'Grammaire';
                if (currentCategory.includes('Adjectif')) currentCategory = 'Adjectifs';
                if (currentCategory.includes('Temps')) currentCategory = 'Temps';
                if (currentCategory.includes('Saison')) currentCategory = 'Temps';
                if (currentCategory.includes('Culture')) currentCategory = 'Général';
                if (currentCategory.includes('Préposition')) currentCategory = 'Lieux';
                if (currentCategory.includes('Conjugaison')) currentCategory = 'Verbes';
                if (currentCategory.includes('Connecteur')) currentCategory = 'Expressions';
            }
            continue;
        }

        if (line.includes(' - ')) {
            const parts = line.split(' - ');
            if (parts.length < 2) continue;
            
            let part1 = parts[0].trim();
            let part2 = parts.slice(1).join(' - ').trim();

            if (!part1 || !part2) continue;

            let korean, french;
            
            // Smart detection of which side is Korean
            if (isKorean(part1) && !isKorean(part2)) {
                korean = part1;
                french = part2;
            } else if (!isKorean(part1) && isKorean(part2)) {
                korean = part2;
                french = part1;
            } else {
                // Fallback: assume first part is Korean as in the current file
                korean = part1;
                french = part2;
            }

            words.push({ 
                korean, 
                french, 
                category: currentCategory, 
                added_by: 'AI Assistant' 
            });
        }
    }

    return words;
}

// --- Main execution function ---
async function main() {
    console.log('🚀 Démarrage du script d\'importation amélioré...');

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

    try {
        // 1. Fetch existing words
        const { data: existingWordsData, error: fetchError } = await client
            .from('vocabulary')
            .select('korean, french');

        if (fetchError) {
            console.error('❌ Erreur lors de la récupération du vocabulaire existant:', fetchError.message);
            return;
        }

        const existingKoreanWords = new Set(existingWordsData.map(w => w.korean));
        const existingFrenchWords = new Set(existingWordsData.map(w => w.french));
        
        console.log(`📚 ${existingWordsData.length} mots déjà présents dans la base de données.`);

        // 2. Filter out duplicates (based on Korean word)
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
        
        // Chunking the insertion to avoid potential limits if there are many words
        const chunkSize = 50;
        let successCount = 0;
        
        for (let i = 0; i < wordsToAdd.length; i += chunkSize) {
            const chunk = wordsToAdd.slice(i, i + chunkSize);
            const { error: insertError } = await client.from('vocabulary').insert(chunk);
            
            if (insertError) {
                console.error(`❌ Erreur lors de l'insertion d'un lot (${i} à ${i + chunk.length}):`, insertError.message);
            } else {
                successCount += chunk.length;
                console.log(`✅ Lot ajouté (${successCount}/${wordsToAdd.length})`);
            }
        }

        console.log(`🎉 Succès ! ${successCount} nouveaux mots ont été ajoutés.`);
        console.log('👋 Script terminé.');
    } catch (err) {
        console.error('❌ Une erreur inattendue s\'est produite:', err.message);
    }
}

main();
