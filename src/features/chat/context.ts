var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { API_ROOT } from '../../utils';
export class ContextBuilder {
    //constructor(private client: LanguageServerClient) {}
    constructor(repoId) {
        this.repoId = repoId;
        // TODO - refactor this to actually use the LSP
        this.previousSymbols = [];
        this.previousSymbolsFuture = null;
        console.log('Restarting with new repoId', repoId);
        setInterval(() => {
            this.previousSymbols = null;
            this.previousSymbolsFuture = null;
        }, 30000);
    }
    getSymbols() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.repoId == null) {
                return [];
            }
            let resp = yield fetch(API_ROOT + '/repos/private/all_symbols/' + this.repoId, {
                method: 'GET',
            });
            let result = yield resp.json();
            console.log('RESULT', result);
            return result;
        });
    }
    quickGetSymbols(timeout = 5) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.previousSymbols) {
                return this.previousSymbols;
            }
            if (this.previousSymbolsFuture) {
                yield Promise.race([
                    this.previousSymbolsFuture,
                    new Promise((resolve, reject) => setTimeout(() => resolve(null), timeout)),
                ]);
            }
            if (this.previousSymbols) {
                return this.previousSymbols;
            }
            else {
                return [];
            }
        });
    }
    getCompletion(currentText, relevantDocs) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.previousSymbolsFuture == null) {
                this.previousSymbolsFuture = this.getSymbols().then((result) => {
                    this.previousSymbols = result;
                    return { query: currentText };
                });
            }
            let symbols = yield this.quickGetSymbols(1000);
            let start = performance.now();
            let finalSymbols = [
                ...symbols
                    .filter((symbol) => symbol[0].toLowerCase().includes(currentText.toLowerCase()))
                    .map(([name, block_type, summary, fname]) => {
                    let startIndex = name
                        .toLowerCase()
                        .indexOf(currentText.toLowerCase());
                    console.log('BLOCK_TYPE', block_type);
                    let endIndex = startIndex + currentText.length;
                    return {
                        type: block_type,
                        path: fname,
                        name,
                        summary,
                        startIndex,
                        endIndex,
                    };
                })
                    .sort((a, b) => {
                    let startsA = a.name
                        .toLowerCase()
                        .startsWith(currentText.toLowerCase());
                    let startsB = b.name
                        .toLowerCase()
                        .startsWith(currentText.toLowerCase());
                    if (startsA && !startsB) {
                        return -1;
                    }
                    else if (!startsA && startsB) {
                        return 1;
                    }
                    else {
                        if (a.name.length < b.name.length) {
                            return -1;
                        }
                        else if (a.name.length > b.name.length) {
                            return 1;
                        }
                        else {
                            let type_orderings = [
                                'class',
                                'function',
                                'variable',
                                'import',
                            ];
                            let aOrder = type_orderings.indexOf(a.type);
                            let bOrder = type_orderings.indexOf(b.type);
                            return aOrder - bOrder;
                        }
                    }
                }),
            ];
            console.log('Time to generate', performance.now() - start);
            // Return the finalSymbols array
            return finalSymbols.slice(0, 20);
        });
    }
}
