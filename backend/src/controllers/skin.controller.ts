/**
 * Skin Analysis Controller
 * Handles skin analysis and wellness recommendations
 */

import { Request, Response } from 'express';

interface SkinAnalysisRequest {
  image: string; // Base64 encoded image
  sessionId?: string;
  analysisType?: 'texture' | 'redness' | 'oiliness' | 'comprehensive';
}

interface SkinAnalysisResponse {
  analysisType: string;
  results: {
    texture: {
      score: number; // 0-100
      description: string;
      confidence: number;
    };
    redness: {
      score: number; // 0-100
      description: string;
      confidence: number;
    };
    oiliness: {
      score: number; // 0-100
      description: string;
      confidence: number;
    };
    overallHealth: {
      score: number; // 0-100
      description: string;
    };
  };
  recommendations: {
    skincare: string[];
    lifestyle: string[];
    nutrition: string[];
  };
  timestamp: string;
}

export const analyzeSkin = async (req: Request, res: Response) => {
  try {
    const { image, sessionId = 'default', analysisType = 'comprehensive' }: SkinAnalysisRequest = req.body;

    console.log('[Skin] 🔬 Processing skin analysis:', {
      hasImage: !!image,
      analysisType,
      sessionId
    });

    // Simulate skin analysis (in production, this would use computer vision models)
    const textureScore = Math.random() * 40 + 60; // 60-100
    const rednessScore = Math.random() * 30 + 10; // 10-40 (lower is better)
    const oilinessScore = Math.random() * 50 + 25; // 25-75

    const overallHealth = (textureScore + (100 - rednessScore) + (100 - Math.abs(oilinessScore - 50))) / 3;

    const response: SkinAnalysisResponse = {
      analysisType,
      results: {
        texture: {
          score: Math.round(textureScore),
          description: textureScore > 80 ? 'Excellent skin texture' : 
                      textureScore > 60 ? 'Good skin texture' : 'Needs improvement',
          confidence: Math.random() * 0.2 + 0.8 // 80-100%
        },
        redness: {
          score: Math.round(rednessScore),
          description: rednessScore < 20 ? 'Minimal redness' : 
                      rednessScore < 40 ? 'Mild redness detected' : 'Significant redness',
          confidence: Math.random() * 0.2 + 0.8
        },
        oiliness: {
          score: Math.round(oilinessScore),
          description: oilinessScore < 40 ? 'Dry skin' : 
                      oilinessScore < 60 ? 'Balanced skin' : 'Oily skin',
          confidence: Math.random() * 0.2 + 0.8
        },
        overallHealth: {
          score: Math.round(overallHealth),
          description: overallHealth > 80 ? 'Excellent skin health' : 
                      overallHealth > 60 ? 'Good skin health' : 'Needs attention'
        }
      },
      recommendations: {
        skincare: [
          'Use a gentle cleanser twice daily',
          'Apply moisturizer with SPF in the morning',
          'Use a night cream with retinol',
          'Exfoliate 2-3 times per week'
        ],
        lifestyle: [
          'Get 7-8 hours of sleep nightly',
          'Stay hydrated - drink 8 glasses of water daily',
          'Exercise regularly for better circulation',
          'Manage stress through meditation or yoga'
        ],
        nutrition: [
          'Eat foods rich in antioxidants (berries, leafy greens)',
          'Include omega-3 fatty acids (fish, nuts)',
          'Limit processed foods and sugar',
          'Consider collagen supplements'
        ]
      },
      timestamp: new Date().toISOString()
    };

    console.log('[Skin] ✅ Analysis complete:', {
      overallHealth: Math.round(overallHealth),
      texture: Math.round(textureScore),
      redness: Math.round(rednessScore),
      oiliness: Math.round(oilinessScore)
    });

    res.json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('[Skin] ❌ Analysis failed:', error);
    res.status(500).json({
      success: false,
      error: 'Skin analysis failed'
    });
  }
};

export const getSkinHistory = async (req: Request, res: Response) => {
  try {
    const { sessionId = 'default', days = 30 } = req.query;

    console.log('[Skin] 📊 Fetching skin history:', { sessionId, days });

    // Generate mock historical data
    const history = [];
    const now = new Date();
    
    for (let i = parseInt(days as string) - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      history.push({
        date: date.toISOString().split('T')[0],
        textureScore: Math.random() * 20 + 70, // 70-90
        rednessScore: Math.random() * 15 + 15,  // 15-30
        oilinessScore: Math.random() * 20 + 40, // 40-60
        overallHealth: Math.random() * 15 + 75 // 75-90
      });
    }

    res.json({
      success: true,
      data: {
        sessionId,
        history,
        summary: {
          averageHealth: history.reduce((sum, day) => sum + day.overallHealth, 0) / history.length,
          trend: history.length > 1 ? 
            (history[history.length - 1].overallHealth - history[0].overallHealth) : 0,
          improvement: history.length > 7 ? 
            (history.slice(-7).reduce((sum, day) => sum + day.overallHealth, 0) / 7) -
            (history.slice(0, 7).reduce((sum, day) => sum + day.overallHealth, 0) / 7) : 0
        }
      }
    });

  } catch (error) {
    console.error('[Skin] ❌ History fetch failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch skin history'
    });
  }
};
