module.exports = async function handler(req, res) {
  const { query } = req.query;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid query parameter' });
  }

  const sampleResults = [
    {
      title: `Best Yachts Matching "${query}"`,
      description: "This is a placeholder response. The actual results will be dynamically generated.",
      link: "/searches/" + encodeURIComponent(query.toLowerCase().replace(/\s+/g, "-")) + ".html"
    }
  ];

  return res.status(200).json({ success: true, results: sampleResults });
};
