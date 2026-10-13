module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { name, text, title } = req.body || {};

  if (!name || !text || !title) {
    return res.status(400).json({ error: 'Missing name, title, or text parameter in JSON body' });
  }

  const apiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY is not set in environment variables' });
  }

  const systemMessage = `당신은 주역(易經) 판본 및 역대 주석서에 정통한 동양고전학 전문가입니다.
다음 원칙을 반드시 지키세요:
1. 각 학자가 해당 구절에 대해 실제로 남긴 한문 원문(原文)을 먼저 인용하고, 그 다음 한국어로 번역하세요.
2. 원문이 기억나지 않거나 불확실하면, original 필드에 "원문 미상(未詳)"이라고 적고 translation에 해당 학자의 학풍과 주역 해석 관점에 따른 설명을 작성하세요.
3. 절대로 다른 학자의 주석을 혼용하거나, 없는 내용을 지어내지 마세요.
4. 각 학자의 학풍과 특징:
   - 왕필(王弼, 226-249): 의리역학(義理易學)의 시조, 노장철학으로 주역 해석
   - 공영달(孔穎達, 574-648): 『주역정의(周易正義)』 저자, 왕필 주석 보완
   - 소식(蘇軾, 1037-1101): 『동파역전(東坡易傳)』 저자, 역사적·실용적 해석
   - 정이(程頤, 1033-1107): 『이천역전(伊川易傳)』 저자, 성리학적 도덕적 해석
   - 주희(朱熹, 1130-1200): 『주역본의(周易本義)』 저자, 점서(占筮)적 본의 강조
   - 쌍호호씨(胡炳文, 1250-1333): 『주역본의통석(周易本義通釋)』 저자, 주희 계승
   - 운봉호씨(胡一桂, 1247-?): 『주역본의부록찬주(周易本義附錄纂注)』 저자, 주희 계승`;

  const prompt = `주역 '${name}' 괘의 '${title}' 원문입니다:

[원문]
${text}

이 구절에 대한 각 학자의 주석을 아래 JSON 형식으로 반환하세요.
각 학자마다 "original"(한문 원문 인용)과 "translation"(한국어 번역)을 반드시 구분하여 작성하세요.
번역의 문장체는 반드시 '~이다', '~한다'와 같은 평어체(해라체)를 사용하세요.

{
  "title": "${title}",
  "wangbi":     { "original": "한문 원문", "translation": "한국어 번역" },
  "kongyingda": { "original": "한문 원문", "translation": "한국어 번역" },
  "sushi":      { "original": "한문 원문", "translation": "한국어 번역" },
  "chengyi":    { "original": "한문 원문", "translation": "한국어 번역" },
  "zhuxi":      { "original": "한문 원문", "translation": "한국어 번역" },
  "shuanghu":   { "original": "한문 원문", "translation": "한국어 번역" },
  "yunfeng":    { "original": "한문 원문", "translation": "한국어 번역" }
}
순수 JSON만 반환하세요.`;

  try {
    const openaiUrl = 'https://api.openai.com/v1/chat/completions';

    let response;
    let data;
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await fetch(openaiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' }
        })
      });

      if (response.ok) {
        data = await response.json();
        break;
      }

      if (attempt === 2) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`);
      }
      await new Promise(r => setTimeout(r, 1500));
    }

    const responseText = data.choices?.[0]?.message?.content?.trim() || '{}';

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).send(responseText);
  } catch (error) {
    console.error('Iching API Error:', error);
    res.status(500).json({ error: error.message });
  }
}
