import Database from 'better-sqlite3';
import { XMLBuilder } from 'xmlbuilder2/lib/interfaces';
import { create } from 'xmlbuilder2';
import * as log from 'electron-log';
import * as fs from 'fs-extra';
import * as path from 'path';

// Compiled regex for removing invalid XML characters
const INVALID_XML_REGEX = /[^	\n\r\u0020-\uD7FF\uE000-\uFFFD]/g;

// Best-effort mapping from internal reference_type codes to EndNote ref-type codes
const ENDNOTE_REF_TYPE_MAP: { [key: number]: number } = {
    0: 17,   // default -> Journal Article
    1: 6,    // maps to Book in baseline
    2: 32,   // maps to Thesis
    3: 10,   // maps to Conference Proceedings
    7: 5,    // maps to Book Section
    10: 27,  // maps to Report
    22: 31,  // Statute
    31: 13,  // Generic
    37: 34,  // Unpublished Work
    43: 56,  // Blog
    46: 57,  // Serial (conference series)
    48: 59,  // Dataset
};

// Human-readable names for common EndNote ref-type numeric codes
const REF_TYPE_NAMES: { [key: number]: string } = {
    5: "Book Section",
    6: "Book",
    10: "Conference Proceedings",
    13: "Generic",
    17: "Journal Article",
    27: "Report",
    31: "Statute",
    32: "Thesis",
    34: "Unpublished Work",
    56: "Blog",
    57: "Serial",
    59: "Dataset",
};

// Small mapping of known journal full-titles to their common abbreviated forms
const JOURNAL_ABBREVS: { [key: string]: string } = {
    "NDT & E International": "Ndt&E Int",
    "IOP Conference Series: Materials Science and Engineering": "IOP Conf Ser: Mater Sci Eng",
};


function splitKeywords(raw: string | null | undefined): string[] {
    if (!raw) {
        return [];
    }
    const s = String(raw);
    if (s.includes('\n') || s.includes('\r')) {
        return s.split(/\r?\n/).map(p => p.trim()).filter(p => p);
    }
    if (s.includes(';')) {
        return s.split(';').map(p => p.trim()).filter(p => p);
    }
    return [s.trim()];
}

function isReasonableAbbr(s: string | null | undefined): boolean {
    if (!s) {
        return false;
    }
    const str = String(s).trim();
    if (str.length === 0 || str.length > 40) {
        return false;
    }
    if (!/[a-zA-Z0-9]/.test(str)) {
        return false;
    }
    const nonAscii = str.split('').filter(ch => ch.charCodeAt(0) > 127).length;
    if (nonAscii / Math.max(1, str.length) > 0.3) {
        return false;
    }
    return true;
}


function formatTimestamp(ts: any): [Date | null, string | null] {
    if (ts === null || ts === undefined || ts === 0 || ts === '') {
        return [null, null];
    }
    try {
        let timestamp = ts;
        if (typeof ts === 'string' && /^\d+$/.test(ts)) {
            timestamp = parseInt(ts, 10);
        } else if (typeof ts === 'string') {
            try {
                timestamp = parseInt(String(parseFloat(ts)), 10);
            } catch (e) {
                // ignore
            }
        }
        const dt = new Date(timestamp * 1000);
        return [dt, dt.toISOString()];
    } catch (e) {
        return [null, null];
    }
}

function safeStr(input: any): string {
    if (input === null || input === undefined) {
        return '';
    }
    try {
        const s = String(input).trim();
        return s.replace(INVALID_XML_REGEX, '') || '';
    } catch (e) {
        log.warn(`Error sanitizing string for XML: ${input}`);
        return '';
    }
}


export class EndnoteExporter {
    public exportReferencesToXml(
        enlFilePath: string,
        outputFilePath: string,
        progressCallback: (message: string) => void
    ): { count: number; outputPath: string } {
        log.debug(`Starting export for ${enlFilePath} to ${outputFilePath}`);
        return this._export(enlFilePath, outputFilePath, progressCallback);
    }

    private _export(
        enlFilePath: string,
        outputFilePath: string,
        progressCallback: (message: string) => void
    ): { count: number; outputPath: string } {
        const basePath = path.dirname(enlFilePath);
        const libraryName = path.basename(enlFilePath, '.enl');
        const outputPath = outputFilePath || path.join(basePath, `${libraryName}_zotero_export.xml`);
        const dataPath = path.join(basePath, `${libraryName}.Data`);
        const dbPath = path.join(dataPath, 'sdb', 'sdb.eni');

        if (!fs.existsSync(dbPath)) {
            const errorMsg = `Database file not found at '${dbPath}'. Make sure the .Data folder exists.`;
            log.error(errorMsg);
            throw new Error(errorMsg);
        }

        log.debug(`Using database at ${dbPath}`);

        let db: Database.Database;
        try {
            db = new Database(dbPath);

            const allRefs = db.prepare('SELECT * FROM refs WHERE trash_state = 0').all();
            const allFiles = db.prepare('SELECT refs_id, file_path FROM file_res').all();

            const fileMapping = new Map<number, string[]>();
            for (const file of allFiles as { refs_id: number; file_path: string }[]) {
                if (!fileMapping.has(file.refs_id)) {
                    fileMapping.set(file.refs_id, []);
                }
                fileMapping.get(file.refs_id)!.push(file.file_path);
            }

            log.debug(`Found ${allRefs.length} references and ${allFiles.length} files in the database.`);

            const xmlRoot = create({ version: '1.0', encoding: 'UTF-8' }).ele('xml');
            const records = xmlRoot.ele('records');

            log.debug(`Starting parsing the data to create the xml file.`);
            progressCallback(`Found ${allRefs.length} references. Parsing data...`);
            log.debug(`Writing output XML to ${outputPath}.`);
            let processedCount = 0;
            for (const ref of allRefs as any[]) {
                try {
                    const recordDict = this.buildRecordDict(ref, fileMapping, dataPath);
                    this.dictToXml(recordDict, records);
                    processedCount++;
                    if (processedCount % 100 === 0) {
                        progressCallback(`Processed ${processedCount} of ${allRefs.length} references...`);
                    }
                } catch (e: any) {
                    log.error(`Error processing reference ID ${ref.id}: ${e.message}\nSkipping this record.`);
                    progressCallback(`Error on record ${ref.id}: ${e.message}. Skipping.`);
                    continue;
                }
            }

            const prettyXml = xmlRoot.end({ prettyPrint: true });

            if (prettyXml) {
                fs.writeFileSync(outputPath, prettyXml, 'utf-8');
            } else {
                log.error('No XML content generated; output file not written.');
                return { count: 0, outputPath: '' };
            }

            log.info(`Exported ${allRefs.length} references to ${outputPath}`);
            return { count: allRefs.length, outputPath };
        } finally {
            if (db) {
                db.close();
            }
            log.debug('Database connection closed.');
        }
    }


    private buildRecordDict(ref: any, fileMapping: Map<number, string[]>, dataPath: string): any {
        const record: any = {};

        record['rec-number'] = ref.id;
        const rawRefType = parseInt(String(ref.reference_type || 0), 10);
        const mapped = ENDNOTE_REF_TYPE_MAP[rawRefType] || rawRefType;
        record['ref-type'] = { value: mapped, name: REF_TYPE_NAMES[mapped] || '' };

        const [, addedIso] = formatTimestamp(ref.added_to_library);
        const [, modifiedIso] = formatTimestamp(ref.record_last_updated);

        const recordDates: any = {};
        if (ref.year) {
            recordDates.year = ref.year;
        }
        record.dates = recordDates;
        if (ref.date) {
            record.dates['pub-dates'] = { date: ref.date };
        }

        record.titles = {
            title: ref.title,
            'secondary-title': ref.secondary_title,
            'short-title': ref.short_title || '',
            'alt-title': ref.alternate_title || ref.alt_title || '',
        };

        if (ref.author) {
            const authors = String(ref.author).trim().split(/\r?\n/).map(a => a.trim());
            record.contributors = { authors };
            if (ref.secondary_author) {
                const sa = ref.secondary_author;
                let saList: string[];
                if (typeof sa === 'string') {
                    saList = sa.replace(/\r/g, '\n').split('\n').map(s => s.trim()).filter(s => s);
                } else if (Array.isArray(sa)) {
                    saList = sa;
                } else {
                    saList = [String(sa)];
                }
                record.contributors['secondary-authors'] = saList;
            }
        }

        record.pages = ref.pages;
        record.volume = ref.volume;
        record.number = ref.number;
        record.abstract = ref.abstract;
        if (ref.isbn) {
            record.isbn = String(ref.isbn).replace(/\r\n/g, '\r').replace(/\n/g, '\r');
        }

        if (ref.electronic_resource_number) {
            record['electronic-resource-num'] = ref.electronic_resource_number;
        }

        if (ref.language) {
            record.language = ref.language;
        }

        if (ref.secondary_title && mapped === 17) {
            record.periodical = { 'full-title': ref.secondary_title };
        }

        if (ref.type_of_work) {
            record['work-type'] = ref.type_of_work;
        }

        const altTitle = ref.alternate_title || ref.alt_title;
        const shortTitle = ref.short_title;
        const secTitle = ref.secondary_title;
        if (altTitle) {
            if (secTitle && String(altTitle).trim().length < String(secTitle).trim().length) {
                if (record.periodical) {
                    record.periodical['abbr-1'] = altTitle;
                } else {
                    record['alt-periodical'] = { 'abbr-1': altTitle };
                }
            } else {
                const alt: any = { 'full-title': altTitle };
                if (shortTitle && typeof shortTitle === 'string' && isReasonableAbbr(shortTitle)) {
                    alt['abbr-1'] = shortTitle;
                }
                record['alt-periodical'] = alt;
            }
        } else {
            if (shortTitle && record.periodical && typeof shortTitle === 'string' && isReasonableAbbr(shortTitle)) {
                record.periodical['abbr-1'] = shortTitle;
            }
        }

        if (record.periodical && record.periodical['full-title']) {
            const ft = record.periodical['full-title'];
            if (!record.periodical['abbr-1'] && JOURNAL_ABBREVS[ft] && isReasonableAbbr(JOURNAL_ABBREVS[ft])) {
                record.periodical['abbr-1'] = JOURNAL_ABBREVS[ft];
            }
        }

        if (mapped !== 17 && record['alt-periodical']) {
            delete record['alt-periodical'];
        }

        if ([3, 10, 46].includes(mapped)) {
            if (!ref.secondary_title && altTitle) {
                record.titles['tertiary-title'] = altTitle;
            }
        }

        if (ref.publisher) {
            record.publisher = ref.publisher;
        }

        if (ref.author_address) {
            record['auth-address'] = String(ref.author_address || '').trim().replace(/\r\n/g, '\r').replace(/\n/g, '\r');
        }

        const urls: any = {};
        if (ref.url) {
            urls['web-urls'] = String(ref.url).trim().split(/\s+/);
        }

        if (fileMapping.has(ref.id)) {
            const pdfUrls: string[] = [];
            const pdfFolderPath = path.join(dataPath, 'PDF');
            for (const filePath of fileMapping.get(ref.id)!) {
                const fullPdfPath = path.resolve(pdfFolderPath, filePath);
                pdfUrls.push(fullPdfPath);
                if (!fs.existsSync(fullPdfPath)) {
                    log.debug(`PDF file not found ${fullPdfPath}`);
                }
            }
            if (pdfUrls.length > 0) {
                urls['pdf-urls'] = pdfUrls;
            }
        }
        if (Object.keys(urls).length > 0) {
            record.urls = urls;
        }

        if (ref.keywords) {
            const kws = splitKeywords(ref.keywords);
            if (kws.length > 0) {
                record.keywords = { keyword: kws };
            }
        }

        const originalNotes = ref.notes || '';
        const dateMetadata = [];
        if (addedIso) {
            dateMetadata.push(`Created: ${addedIso}`);
        }
        if (modifiedIso) {
            dateMetadata.push(`Modified: ${modifiedIso}`);
        }
        let combinedNotes = dateMetadata.join('\n');
        if (String(originalNotes).trim()) {
            combinedNotes = `${String(originalNotes).trim()}\n\n${combinedNotes}`;
        }
        record.notes = combinedNotes;

        return record;
    }


    private dictToXml(recordDict: any, parent: XMLBuilder): void {
        const record = parent.ele('record');

        record.ele('rec-number').txt(safeStr(recordDict['rec-number']));
        record.ele('ref-type', { name: safeStr(recordDict['ref-type'].name) }).txt(safeStr(recordDict['ref-type'].value));

        const dates = record.ele('dates');
        if (recordDict.dates && recordDict.dates.year) {
            dates.ele('year').txt(safeStr(recordDict.dates.year));
        }
        if (recordDict.dates && recordDict.dates['pub-dates']) {
            const pd = recordDict.dates['pub-dates'];
            const pubnode = dates.ele('pub-dates');
            if (pd && pd.date) {
                pubnode.ele('date').txt(safeStr(pd.date));
            }
        }

        const titles = record.ele('titles');
        titles.ele('title').txt(safeStr(recordDict.titles.title));
        titles.ele('secondary-title').txt(safeStr(recordDict.titles['secondary-title']));
        if (recordDict.titles['short-title']) {
            titles.ele('short-title').txt(safeStr(recordDict.titles['short-title']));
        }
        if (recordDict.titles['tertiary-title']) {
            titles.ele('tertiary-title').txt(safeStr(recordDict.titles['tertiary-title']));
        }
        if (recordDict.titles['alt-title']) {
            titles.ele('alt-title').txt(safeStr(recordDict.titles['alt-title']));
        }

        if (recordDict.contributors) {
            const contributors = record.ele('contributors');
            const authors = contributors.ele('authors');
            for (const author of recordDict.contributors.authors) {
                authors.ele('author').txt(safeStr(author));
            }
            if (recordDict.contributors['secondary-authors']) {
                const secNode = contributors.ele('secondary-authors');
                for (const author of recordDict.contributors['secondary-authors']) {
                    secNode.ele('author').txt(safeStr(author));
                }
            }
        }

        if (recordDict.periodical) {
            const per = record.ele('periodical');
            per.ele('full-title').txt(safeStr(recordDict.periodical['full-title']));
            if (recordDict.periodical['abbr-1']) {
                per.ele('abbr-1').txt(safeStr(recordDict.periodical['abbr-1']));
            }
        }

        if(recordDict.pages) record.ele('pages').txt(safeStr(recordDict.pages));
        if(recordDict.volume) record.ele('volume').txt(safeStr(recordDict.volume));
        if(recordDict.number) record.ele('number').txt(safeStr(recordDict.number));
        if(recordDict.abstract) record.ele('abstract').txt(safeStr(recordDict.abstract));
        if(recordDict.isbn) record.ele('isbn').txt(safeStr(recordDict.isbn));

        if (recordDict['work-type']) {
            record.ele('work-type').txt(safeStr(recordDict['work-type']));
        }
        if (recordDict.publisher) {
            record.ele('publisher').txt(safeStr(recordDict.publisher));
        }

        if (recordDict['auth-address']) {
            record.ele('auth-address').txt(safeStr(recordDict['auth-address']));
        }

        if (recordDict['electronic-resource-num']) {
            record.ele('electronic-resource-num').txt(safeStr(recordDict['electronic-resource-num']));
        }

        if (recordDict.language) {
            record.ele('language').txt(safeStr(recordDict.language));
        }

        if (recordDict.urls) {
            const urlsNode = record.ele('urls');
            if (recordDict.urls['web-urls']) {
                const webUrls = urlsNode.ele('web-urls');
                for (const url of recordDict.urls['web-urls']) {
                    webUrls.ele('url').txt(safeStr(url));
                }
            }
            if (recordDict.urls['pdf-urls']) {
                const pdfUrls = urlsNode.ele('pdf-urls');
                for (const url of recordDict.urls['pdf-urls']) {
                    pdfUrls.ele('url').txt(safeStr(url));
                }
            }
        }

        if (recordDict.keywords) {
            const kwNode = record.ele('keywords');
            for (const kw of recordDict.keywords.keyword) {
                kwNode.ele('keyword').txt(safeStr(kw));
            }
        }

        if(recordDict.notes) record.ele('notes').txt(safeStr(recordDict.notes));
    }
}
