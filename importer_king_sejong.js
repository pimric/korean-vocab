// importer_king_sejong.js
// Importe les leçons King Sejong Vol.1 et Vol.2 dans les tables lessons et items de Supabase
// Vol.1 : lesson_number 1-14 | Vol.2 : lesson_number 15-28

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://lkhcemzurtyyaqctdedb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxraGNlbXp1cnR5eWFxY3RkZWRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MTcwMjgsImV4cCI6MjA3NzM5MzAyOH0.-BjUQu7NhRPQGKEyeDHowiWeU2cDgdUqlOeNmdy5Rgc';
const client = createClient(SUPABASE_URL, SUPABASE_KEY);

const VOL2_OFFSET = 14; // Vol.2 lessons: 15-28

// Parse CSV en tenant compte des guillemets
function parseCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const headers = parseCSVLine(lines[0]);

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const values = parseCSVLine(line);
        const obj = {};
        headers.forEach((h, idx) => {
            obj[h.trim()] = values[idx] !== undefined ? values[idx].trim() : '';
        });
        rows.push(obj);
    }
    return rows;
}

function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuote = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuote && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuote = !inQuote;
            }
        } else if (ch === ',' && !inQuote) {
            values.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    values.push(current);
    return values;
}


async function importLessons() {
    console.log('\n📚 Importation des leçons...');

    // Vol.1 : lesson_number 1-14
    const vol1 = parseCSV(path.resolve('./files/lessons_vol1.csv'));
    const lessonsVol1 = vol1.map(row => ({
        lesson_number: parseInt(row.lesson_number),
        volume: 1,
        title_ko: row.title_ko,
        title_fr: row.title_fr,
        topic_ko: row.topic_ko,
        topic_fr: row.topic_fr,
    }));

    // Vol.2 : lesson_number 15-28 (offset +14)
    const vol2 = parseCSV(path.resolve('./files/lessons.csv'));
    const lessonsVol2 = vol2.map(row => ({
        lesson_number: parseInt(row.lesson_number) + VOL2_OFFSET,
        volume: 2,
        title_ko: row.title_ko,
        title_fr: row.title_fr,
        topic_ko: row.topic_ko,
        topic_fr: row.topic_fr,
    }));

    const allLessons = [...lessonsVol1, ...lessonsVol2];
    console.log(`  ${allLessons.length} leçons trouvées (${lessonsVol1.length} Vol.1 + ${lessonsVol2.length} Vol.2)`);

    // Vérifier les doublons
    const { data: existing } = await client.from('lessons').select('lesson_number');
    const existingNums = new Set((existing || []).map(l => l.lesson_number));
    const toInsert = allLessons.filter(l => !existingNums.has(l.lesson_number));

    if (toInsert.length === 0) {
        console.log('  ℹ️  Toutes les leçons existent déjà.');
        return allLessons.length;
    }

    console.log(`  ➕ ${toInsert.length} nouvelles leçons à insérer...`);
    const { error } = await client.from('lessons').insert(toInsert);
    if (error) {
        console.error('  ❌ Erreur insertion leçons:', error.message);
        return 0;
    }
    console.log(`  ✅ ${toInsert.length} leçons insérées !`);
    return toInsert.length;
}

async function importItems() {
    console.log('\n📝 Importation des items (vocabulaire, expressions, grammaire)...');

    // Vol.1
    const rawVol1 = parseCSV(path.resolve('./files/items_vol1.csv'));
    const itemsVol1 = rawVol1.map(row => ({
        lesson_number: parseInt(row.lesson_number),
        volume: 1,
        type: row.type,
        korean: row.korean,
        french: row.french,
        grammar_explanation: row.grammar_explanation || '',
        grammar_form_note: row.grammar_form_note || '',
        example_sentence: row.example_sentence || '',
        sort_order: parseInt(row.sort_order) || 0,
    }));

    // Vol.2 : offset lesson_number +14
    const rawVol2 = parseCSV(path.resolve('./files/items.csv'));
    const itemsVol2 = rawVol2.map(row => ({
        lesson_number: parseInt(row.lesson_number) + VOL2_OFFSET,
        volume: 2,
        type: row.type,
        korean: row.korean,
        french: row.french,
        grammar_explanation: row.grammar_explanation || '',
        grammar_form_note: row.grammar_form_note || '',
        example_sentence: row.example_sentence || '',
        sort_order: parseInt(row.sort_order) || 0,
    }));

    const allItems = [...itemsVol1, ...itemsVol2];
    console.log(`  ${allItems.length} items trouvés (${itemsVol1.length} Vol.1 + ${itemsVol2.length} Vol.2)`);

    // Vérifier les doublons (par korean + lesson_number)
    const { data: existing } = await client
        .from('items')
        .select('korean, lesson_number');

    const existingKeys = new Set((existing || []).map(i => `${i.lesson_number}:${i.korean}`));
    const toInsert = allItems.filter(i => !existingKeys.has(`${i.lesson_number}:${i.korean}`));

    if (toInsert.length === 0) {
        console.log('  ℹ️  Tous les items existent déjà.');
        return 0;
    }

    console.log(`  ➕ ${toInsert.length} nouveaux items à insérer...`);

    let inserted = 0;
    const chunkSize = 50;
    for (let i = 0; i < toInsert.length; i += chunkSize) {
        const chunk = toInsert.slice(i, i + chunkSize);
        const { error } = await client.from('items').insert(chunk);
        if (error) {
            console.error(`  ❌ Erreur lot ${i}-${i + chunk.length}: ${error.message}`);
        } else {
            inserted += chunk.length;
            process.stdout.write(`\r  ✅ ${inserted}/${toInsert.length} items insérés...`);
        }
    }
    console.log(`\n  🎉 ${inserted} items insérés !`);
    return inserted;
}

async function printStats() {
    const { data: lessons, error: le } = await client.from('lessons').select('lesson_number, volume, title_fr');
    const { data: items, error: ie } = await client.from('items').select('lesson_number, volume, type');

    if (le || ie) return;

    console.log('\n📊 État de la base de données :');
    console.log(`  Leçons : ${lessons.length} (Vol.1 : ${lessons.filter(l => l.volume === 1).length}, Vol.2 : ${lessons.filter(l => l.volume === 2).length})`);
    console.log(`  Items  : ${items.length}`);
    console.log(`    - Vocabulaire : ${items.filter(i => i.type === 'vocabulary').length}`);
    console.log(`    - Expressions : ${items.filter(i => i.type === 'expression').length}`);
    console.log(`    - Grammaire   : ${items.filter(i => i.type === 'grammar').length}`);
}

async function main() {
    console.log('🚀 Importation King Sejong Vol.1 + Vol.2...');
    console.log('   Vol.1 → leçons 1-14');
    console.log('   Vol.2 → leçons 15-28');

    try {
        await importLessons();
        await importItems();
        await printStats();
        console.log('\n👋 Importation terminée !');
    } catch (err) {
        console.error('\n❌ Erreur inattendue:', err.message);
    }
}

main();
