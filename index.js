const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Secure API keys from Environment Variables (Hidden from Frontend)
const OPEN_PAGE_RANK_KEY = process.env.OPR_API_KEY || 'b15f76ad29cf702cdbc9';
const SERPER_API_KEY = process.env.SERPER_API_KEY || '70fb3a379987425872e7579985ab79865ea6d420';

app.post('/api/analyze', async (req, res) => {
    const { domains } = req.body;

    if (!domains || !Array.isArray(domains) || domains.length === 0) {
        return res.status(400).json({ error: 'Please provide at least one domain.' });
    }

    try {
        const oprResponse = await axios.get('https://openpagerank.com/api/v1.0/getPageRank', {
            params: { domains: domains },
            headers: { 'API-OPR': OPEN_PAGE_RANK_KEY }
        });

        const oprData = oprResponse.data.response || [];

        const results = await Promise.all(domains.map(async (domain) => {
            let indexedPages = 'N/A';
            let status = 'Active';

            try {
                const serperRes = await axios.post('https://google.serper.dev/search', {
                    q: `site:${domain}`
                }, {
                    headers: {
                        'X-API-KEY': SERPER_API_KEY,
                        'Content-Type': 'application/json'
                    }
                });

                if (serperRes.data.searchInformation && serperRes.data.searchInformation.totalResults) {
                    indexedPages = serperRes.data.searchInformation.totalResults;
                } else if (serperRes.data.organic) {
                    indexedPages = serperRes.data.organic.length;
                }
            } catch (err) {
                status = 'Error fetching SERP';
            }

            const rankObj = oprData.find(item => item.domain.toLowerCase() === domain.toLowerCase()) || {};
            const pageRankDecimal = rankObj.page_rank_decimal || 0;
            const rank = rankObj.rank || 'N/A';

            return {
                domain: domain,
                pageRank: pageRankDecimal,
                globalRank: rank,
                googleIndexedResults: indexedPages,
                spamRisk: pageRankDecimal < 2 ? 'High Risk' : (pageRankDecimal < 4 ? 'Medium' : 'Low Risk / Safe')
            };
        }));

        res.json({ success: true, data: results });

    } catch (error) {
        console.error(error.message);
        res.status(500).json({ error: 'Failed to fetch metrics from APIs.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Nova SEO Server running on port ${PORT}`));
