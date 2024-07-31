


  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.action === 'fetchSimilarArticles') {
	  fetchSimilarArticles(request.url)
		.then(data => sendResponse({ success: true, data }))
		.catch(error => sendResponse({ success: false, error: error.message }));
	  return true;
	}
  });
  
  async function fetchSimilarArticles(url) {
	const apiKey = process.env.EXA_API_KEY;
	const headers = {
	  'Content-Type': 'application/json',
	  'Accept': 'application/json',
	  'x-api-key': apiKey,
	  'Cross-Origin-Opener-Policy': 'same-origin',
	};
	const body = JSON.stringify({
	  url: url,
	  numResults: 10,
	  excludeDomains: [url.split('/')[2]],
	  contents: {
		text: true,
	  },
	});

	const response = await fetch('https://api.exa.ai/findSimilar', {
	  method: 'POST',
	  headers: headers,
	  body: body,
	});

	const data = await response.json();
	return data.results;
  }