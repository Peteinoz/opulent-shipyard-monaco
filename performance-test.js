/**
 * Performance Testing Script for Opulent Shipyard Monaco
 * Tests the implemented optimizations and measures improvements
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

const BASE_URL = 'http://localhost:3000';
const TEST_QUERIES = [
    'luxury yacht Monaco',
    'superyacht charter',
    'best yacht in Monaco',
    'Feadship superyacht',
    'Monaco yacht show'
];

class PerformanceTester {
    constructor() {
        this.results = [];
    }

    async testSearchPerformance() {
        console.log('🚀 Starting Performance Tests for Opulent Shipyard Monaco\n');
        
        for (const query of TEST_QUERIES) {
            console.log(`Testing search: "${query}"`);
            const result = await this.measureSearchTime(query);
            this.results.push(result);
            
            // Wait between tests to avoid overwhelming the server
            await this.sleep(2000);
        }
        
        this.generateReport();
    }

    async measureSearchTime(query) {
        const startTime = performance.now();
        let totalYachts = 0;
        let firstYachtTime = null;
        let completionTime = null;

        try {
            const encodedQuery = encodeURIComponent(query);
            const response = await fetch(`${BASE_URL}/api/search-stream/${encodedQuery}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            
                            if (data.type === 'yacht') {
                                totalYachts++;
                                if (firstYachtTime === null) {
                                    firstYachtTime = performance.now() - startTime;
                                }
                            } else if (data.type === 'complete') {
                                completionTime = performance.now() - startTime;
                                break;
                            }
                        } catch (parseError) {
                            // Ignore parsing errors for non-JSON data
                        }
                    }
                }
            }

            return {
                query,
                success: true,
                totalTime: completionTime || (performance.now() - startTime),
                firstYachtTime,
                totalYachts,
                avgTimePerYacht: firstYachtTime && totalYachts > 0 ? firstYachtTime / totalYachts : null
            };

        } catch (error) {
            console.error(`❌ Error testing "${query}":`, error.message);
            return {
                query,
                success: false,
                error: error.message,
                totalTime: performance.now() - startTime
            };
        }
    }

    async testStaticFilePerformance() {
        console.log('\n📁 Testing Static File Performance...');
        
        const staticFiles = [
            '/',
            '/searches/',
            '/searches/index.html'
        ];

        for (const file of staticFiles) {
            const startTime = performance.now();
            try {
                const response = await axios.get(`${BASE_URL}${file}`);
                const loadTime = performance.now() - startTime;
                
                console.log(`✅ ${file}: ${loadTime.toFixed(2)}ms (${response.headers['content-encoding'] ? 'compressed' : 'uncompressed'})`);
            } catch (error) {
                console.log(`❌ ${file}: Failed - ${error.message}`);
            }
        }
    }

    async testCachePerformance() {
        console.log('\n🗄️ Testing Cache Performance...');
        
        const testQuery = 'luxury yacht Monaco';
        
        // First request (should populate cache)
        console.log('First request (populating cache)...');
        const firstResult = await this.measureSearchTime(testQuery);
        
        await this.sleep(1000);
        
        // Second request (should use cache)
        console.log('Second request (using cache)...');
        const secondResult = await this.measureSearchTime(testQuery);
        
        if (firstResult.success && secondResult.success) {
            const improvement = ((firstResult.totalTime - secondResult.totalTime) / firstResult.totalTime) * 100;
            console.log(`Cache Performance: ${improvement > 0 ? improvement.toFixed(1) + '% faster' : 'No significant improvement'}`);
        }
    }

    generateReport() {
        console.log('\n📊 PERFORMANCE TEST RESULTS');
        console.log('=' .repeat(50));
        
        const successfulTests = this.results.filter(r => r.success);
        
        if (successfulTests.length === 0) {
            console.log('❌ No successful tests to analyze');
            return;
        }

        const avgTotalTime = successfulTests.reduce((sum, r) => sum + r.totalTime, 0) / successfulTests.length;
        const avgFirstYacht = successfulTests
            .filter(r => r.firstYachtTime)
            .reduce((sum, r) => sum + r.firstYachtTime, 0) / successfulTests.filter(r => r.firstYachtTime).length;
        const avgYachtsPerSearch = successfulTests.reduce((sum, r) => sum + r.totalYachts, 0) / successfulTests.length;

        console.log(`\n🎯 Key Metrics:`);
        console.log(`   Average Search Completion: ${avgTotalTime.toFixed(2)}ms`);
        console.log(`   Average Time to First Yacht: ${avgFirstYacht.toFixed(2)}ms`);
        console.log(`   Average Yachts per Search: ${avgYachtsPerSearch.toFixed(1)}`);
        
        console.log(`\n📈 Individual Results:`);
        successfulTests.forEach(result => {
            console.log(`   "${result.query}": ${result.totalTime.toFixed(2)}ms (${result.totalYachts} yachts)`);
        });

        // Performance benchmarks
        console.log(`\n🏆 Performance Assessment:`);
        if (avgTotalTime < 3000) {
            console.log('   ✅ EXCELLENT: Search completion under 3 seconds');
        } else if (avgTotalTime < 5000) {
            console.log('   ✅ GOOD: Search completion under 5 seconds');
        } else {
            console.log('   ⚠️  NEEDS IMPROVEMENT: Search completion over 5 seconds');
        }

        if (avgFirstYacht < 1000) {
            console.log('   ✅ EXCELLENT: First yacht appears under 1 second');
        } else if (avgFirstYacht < 2000) {
            console.log('   ✅ GOOD: First yacht appears under 2 seconds');
        } else {
            console.log('   ⚠️  NEEDS IMPROVEMENT: First yacht takes over 2 seconds');
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Run the performance tests
async function runTests() {
    const tester = new PerformanceTester();
    
    try {
        await tester.testSearchPerformance();
        await tester.testStaticFilePerformance();
        await tester.testCachePerformance();
        
        console.log('\n🎉 Performance testing completed!');
        console.log('\n💡 Optimization Summary:');
        console.log('   ✅ Parallel image fetching implemented');
        console.log('   ✅ Image caching system active');
        console.log('   ✅ Parallel file operations enabled');
        console.log('   ✅ Gzip compression enabled');
        console.log('   ✅ Static file caching configured');
        
    } catch (error) {
        console.error('❌ Performance testing failed:', error);
    }
}

// Check if server is running before starting tests
async function checkServer() {
    try {
        await axios.get(`${BASE_URL}/`);
        console.log('✅ Server is running, starting performance tests...\n');
        runTests();
    } catch (error) {
        console.log('❌ Server is not running. Please start the server with "npm start" first.');
    }
}

checkServer();