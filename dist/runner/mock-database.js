"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockDatabaseImpl = exports.MockTableQueryImpl = void 0;
class MockTableQueryImpl {
    constructor(data) {
        this.filters = [];
        this.data = [...data];
    }
    collect() {
        let result = this.data;
        for (const filter of this.filters) {
            result = result.filter(filter);
        }
        return Promise.resolve(result);
    }
    first() {
        return this.collect().then(results => results[0] || null);
    }
    unique() {
        return this.collect().then(results => {
            if (results.length !== 1) {
                throw new Error(`Expected exactly 1 result, got ${results.length}`);
            }
            return results[0];
        });
    }
    filter(predicate) {
        const newQuery = new MockTableQueryImpl(this.data);
        newQuery.filters = [...this.filters, predicate];
        return newQuery;
    }
    order(order) {
        const newQuery = new MockTableQueryImpl(this.data);
        newQuery.filters = [...this.filters];
        const sortedData = [...this.data].sort((a, b) => {
            if (order === 'asc') {
                return a._id.localeCompare(b._id);
            }
            else {
                return b._id.localeCompare(a._id);
            }
        });
        newQuery.data = sortedData;
        return newQuery;
    }
    limit(limit) {
        const newQuery = new MockTableQueryImpl(this.data.slice(0, limit));
        newQuery.filters = [...this.filters];
        return newQuery;
    }
}
exports.MockTableQueryImpl = MockTableQueryImpl;
class MockDatabaseImpl {
    constructor(tables = {}) {
        this.tables = JSON.parse(JSON.stringify(tables));
    }
    get(tableName) {
        const tableData = this.tables[tableName] || [];
        return new MockTableQueryImpl(tableData);
    }
    query(tableName) {
        return this.get(tableName);
    }
    async insert(tableName, value) {
        if (!this.tables[tableName]) {
            this.tables[tableName] = [];
        }
        const newRecord = {
            _id: this.generateId(),
            _creationTime: Date.now(),
            ...value
        };
        this.tables[tableName].push(newRecord);
        return newRecord;
    }
    async patch(tableName, id, value) {
        if (!this.tables[tableName]) {
            throw new Error(`Table '${tableName}' does not exist`);
        }
        const recordIndex = this.tables[tableName].findIndex(record => record._id === id);
        if (recordIndex === -1) {
            throw new Error(`Record with id '${id}' not found in table '${tableName}'`);
        }
        const updatedRecord = {
            ...this.tables[tableName][recordIndex],
            ...value
        };
        this.tables[tableName][recordIndex] = updatedRecord;
        return updatedRecord;
    }
    async replace(tableName, id, value) {
        if (!this.tables[tableName]) {
            throw new Error(`Table '${tableName}' does not exist`);
        }
        const recordIndex = this.tables[tableName].findIndex(record => record._id === id);
        if (recordIndex === -1) {
            throw new Error(`Record with id '${id}' not found in table '${tableName}'`);
        }
        const replacedRecord = {
            _id: id,
            _creationTime: this.tables[tableName][recordIndex]._creationTime,
            ...value
        };
        this.tables[tableName][recordIndex] = replacedRecord;
        return replacedRecord;
    }
    async delete(tableName, id) {
        if (!this.tables[tableName]) {
            throw new Error(`Table '${tableName}' does not exist`);
        }
        const recordIndex = this.tables[tableName].findIndex(record => record._id === id);
        if (recordIndex === -1) {
            throw new Error(`Record with id '${id}' not found in table '${tableName}'`);
        }
        this.tables[tableName].splice(recordIndex, 1);
    }
    getTables() {
        return JSON.parse(JSON.stringify(this.tables));
    }
    setTables(tables) {
        this.tables = JSON.parse(JSON.stringify(tables));
    }
    generateId() {
        return Math.random().toString(36).substring(2, 15) +
            Math.random().toString(36).substring(2, 15);
    }
}
exports.MockDatabaseImpl = MockDatabaseImpl;
//# sourceMappingURL=mock-database.js.map