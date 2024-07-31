import React, { useState, useEffect } from 'react';
import { getCurrentTab } from './utils';
import { YoutubeTranscript } from 'youtube-transcript';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, dangerouslyAllowBrowser: true });

function App() {
  const [url, setUrl] = useState('');
  const [apiResponse, setApiResponse] = useState('');
  const [usage, setUsage] = useState('');
  const [loading, setLoading] = useState(false);
  const [similarArticles, setSimilarArticles] = useState([]);

  useEffect(() => {
    getCurrentTab().then(tab => setUrl(tab.url));
  }, []);


  const fetchSimilarArticles = async (url) => {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'fetchSimilarArticles', url: url },
        response => {
          if (response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response.error));
          }
        }
      );
    });
  };


  const getCachedData = async (url) => {
    return new Promise((resolve) => {
      chrome.storage.local.get(url, (result) => {
        resolve(result[url]);
      });
    });
  };
  
  const cacheData = async (url, data) => {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [url]: data }, resolve);
    });
  };

  const handleClick = async () => {
    setLoading(true);
    try {
      const cachedData = await getCachedData(url);
      if (cachedData) {
        setApiResponse(cachedData.summary);
        setUsage(cachedData.usage);
        setSimilarArticles(cachedData.similarArticles);
      } else {
        let contentToSummarize;
        let systemMessage;

        if (url.includes('youtube.com')) {
          const transcript = await YoutubeTranscript.fetchTranscript(url);
          contentToSummarize = JSON.stringify(transcript);
          systemMessage = `You are an AI assistant expert in summarizing content. Provide a concise summary of the given text.
          <YoutubeVideoChaptersGeneration>

        <GenerationRules>
            <Rule>Please generate chapters in the specified FORMAT_FOR_CHAPTER_OUTPUT, </Rule>
            <Rule>Write a detailed summary of each chapter in the.</Rule>
            <Rule>Summary must be in english language.</Rule>
            <Rule>Avoid including minor details or examples unless they are crucial to understanding the main point.</Rule>
        </GenerationRules>

        <FormatForChapterOutput>
          <detailed summary of chapter>
          <detailed summary of chapter>
          <!-- Add additional chapters as needed -->
        </FormatForChapterOutput>
        </YoutubeVideoChaptersGeneration>`;
        } else {
          contentToSummarize = await getPageContent();
          systemMessage = `You are an AI assistant expert in summarizing content. Provide a concise summary of the given text.`
        }

        
console.log(systemMessage);

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: systemMessage,
            },
            { role: "user", content: contentToSummarize }
          ],
        });

        const summary = response.choices[0].message.content;
        const usage = response.usage.total_tokens;
        setUsage(usage);
        setApiResponse(summary);

        const similarArticles = await fetchSimilarArticles(url);
        setSimilarArticles(similarArticles);

        await cacheData(url, { summary, usage, similarArticles });
      }
    } catch (error) {
      console.error(error);
      setApiResponse("Error generating summary or fetching similar articles");
    } finally {
      setLoading(false);
    }
  };

  const getPageContent = () => {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: "getPageContent" }, (response) => {
          resolve(response.content);
        });
      });
    });
  }

  return (
    <div className="w-full max-w-4xl p-6 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">Content Summarizer</h1>
      <p className="mb-4 text-sm text-gray-600 truncate">{url}</p>
      <div className="flex flex-col">
        <button
          onClick={handleClick}
          className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
          disabled={loading}
        >
          {loading ? 'Summarizing...' : 'Summarize Content'}
        </button>
        {loading && (
          <div className="mt-4 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        )}
        {apiResponse && usage && (
          <div className="mt-4 p-4 bg-white rounded-md shadow-md flex flex-col">
            <div className="flex justify-between">
              <h2 className="text-lg font-semibold mb-2 text-gray-800">Summary:</h2>
              <p className="text-sm text-gray-600">Tokens Used: {usage}</p>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{apiResponse}</p>
          </div>
        )}
        {similarArticles.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Similar Articles</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {similarArticles.map((article, index) => (
                <div key={index} className="bg-white p-4 rounded-md shadow-md">
                  <div className="font-semibold mb-2 text-gray-800 ">{article.title}</div>
                  <p className="text-sm text-gray-600 mb-2">Domain: {article.url}</p>
                  <p className="text-sm text-gray-700 line-clamp-3">{article.text}</p>
                  <a 
                    href={article.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-blue-500 hover:text-blue-600 transition duration-300"
                  >
                    Read more
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
