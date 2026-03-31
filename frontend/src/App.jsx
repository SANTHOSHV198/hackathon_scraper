import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, MapPin, Calendar, Trophy, Moon, Sun, Monitor } from 'lucide-react';
import './index.css';

const API_URL = 'http://localhost:3000/api/hackathons';

const getTagColorClass = (tag) => {
  const t = tag.toLowerCase();
  if (t.includes('ai') || t.includes('machine') || t.includes('data')) return 'tag-blue';
  if (t.includes('web') || t.includes('frontend')) return 'tag-purple';
  if (t.includes('health') || t.includes('medical')) return 'tag-green';
  return 'tag-grey';
};

function App() {
  const [hackathons, setHackathons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [themeFilter, setThemeFilter] = useState('');
  const [allThemes, setAllThemes] = useState([]);
  const [theme, setTheme] = useState(
    localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  );

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const fetchHackathons = async () => {
    setLoading(true);
    try {
      const response = await axios.get(API_URL, {
        params: { search, theme: themeFilter }
      });
      setHackathons(response.data.hackathons);
      
      // Extract unique themes from the initial full dataset
      if (!search && !themeFilter && allThemes.length === 0) {
        const themesSet = new Set();
        response.data.hackathons.forEach(h => {
          h.themes.forEach(t => themesSet.add(t));
        });
        setAllThemes(Array.from(themesSet).sort());
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchHackathons();
    }, 300); // 300ms debounce for search

    return () => clearTimeout(delayDebounceFn);
  }, [search, themeFilter]);

  return (
    <div className="app-wrapper">
      <header>
        <div className="container header-content">
          <div className="logo">
            <Monitor size={28} color="var(--primary-color)" />
            <span>HackAggregator</span>
          </div>
          <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle Theme">
            <span className="theme-icon">
              {theme === 'light' ? <Moon size={22} /> : <Sun size={22} />}
            </span>
          </button>
        </div>
      </header>

      <main className="container">
        <section className="controls-section">
          <input 
            type="text" 
            placeholder="Search by title or location..." 
            className="search-bar"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select 
            className="filter-select"
            value={themeFilter}
            onChange={(e) => setThemeFilter(e.target.value)}
          >
            <option value="">All Themes</option>
            {allThemes.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </section>

        {loading ? (
          <div className="loading">Loading Hackathons...</div>
        ) : (
          <section className="hackathon-grid">
            {hackathons.length > 0 ? (
              hackathons.map((h, i) => (
                <div key={h.id} className="card" style={{ animationDelay: `${i * 0.05}s` }}>
                  <div className="card-img-container">
                    <div className="card-img-overlay"></div>
                    {h.thumbnail_url ? (
                      <img src={h.thumbnail_url} alt={`${h.title} logo`} className="card-img" />
                    ) : (
                      <div className="card-placeholder">
                        <Monitor size={48} />
                      </div>
                    )}
                  </div>
                  <div className="card-content">
                    <div className="card-header-group">
                      <div className="card-source">{h.source}</div>
                      <h2 className="card-title">{h.title}</h2>
                    </div>
                    
                    <div className="card-details">
                      <div className="detail-row">
                        <MapPin size={16} />
                        <span>{h.location}</span>
                      </div>
                      <div className="detail-row">
                        <Calendar size={16} />
                        <span>{h.date_raw}</span>
                      </div>
                      <div className="detail-row">
                        <Trophy size={16} />
                        <span>{h.prize_amount || 'TBD'}</span>
                      </div>
                    </div>

                    <div className="themes-container">
                      {h.themes.slice(0, 3).map((t, i) => (
                        <span key={i} className={`theme-tag ${getTagColorClass(t)}`}>
                          {t}
                        </span>
                      ))}
                    </div>

                    <a href={h.url} target="_blank" rel="noopener noreferrer" className="card-action">
                      View Hackathon
                    </a>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-results">No hackathons found matching your criteria.</div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
