const { generateRSSStaticPage } = require('../rss-static-generator');

module.exports = async (req, res) => {
  try {
    console.log('🚀 RSS Build API called');
    
    // Generate new RSS static page
    await generateRSSStaticPage('random');
    
    // Return success response
    res.status(200).json({
      success: true,
      message: 'RSS content generated successfully',
      staticPageUrl: '/rsscontent/',
      indexUrl: '/rsscontent/index.html'
    });
    
  } catch (error) {
    console.error('❌ RSS build error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'RSS build failed'
    });
  }
};