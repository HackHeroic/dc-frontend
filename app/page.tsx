'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface JobStatus {
  jobId: string;
  searchName: string | null; // Keep for backward compatibility
  searchNames?: string[]; // New: array of search names
  foundDates: Array<{
    date: string;
    records: Array<{
      name: string;
      gender: string;
      dateOfDeath: string;
      fathersName: string;
      mothersName: string;
      date?: string;
      matchScore?: number;
      matchedField?: 'name' | 'fathersName' | 'mothersName';
      matchedPart?: string;
      matchedSearchName?: string; // Which search name matched
    }>;
    totalRecordsOnDate?: number;
  }>;
  allRecords: Array<{
    name: string;
    gender: string;
    dateOfDeath: string;
    fathersName: string;
    mothersName: string;
    date: string;
  }>;
  status: string;
  startTime: string;
  lastUpdate: string | null;
  totalRequests: number;
  errors: Array<{
    date: string;
    error: string;
    timestamp: string;
  }>;
  errorDates?: string[];
  retryingErrors?: boolean;
}

export default function Home() {
  const [verificationNumber, setVerificationNumber] = useState('');
  const [token, setToken] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [gender, setGender] = useState('male');
  const [searchNames, setSearchNames] = useState<string[]>(['']);
  const [intervalMinutes, setIntervalMinutes] = useState(60);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Auto-refresh job status
  useEffect(() => {
    if (autoRefresh && currentJobId) {
      const interval = setInterval(() => {
        fetchJobStatus(currentJobId);
      }, 5000); // Refresh every 5 seconds

      return () => clearInterval(interval);
    }
  }, [autoRefresh, currentJobId]);

  const fetchJobStatus = async (jobId: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/job/${jobId}`);
      setJobStatus(response.data);
      
      if (response.data.status === 'stopped') {
        setAutoRefresh(false);
      }
    } catch (err: any) {
      console.error('Error fetching job status:', err);
      setError(err.response?.data?.error || 'Failed to fetch job status');
    }
  };

  const handleStartPolling = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_BASE_URL}/api/start-polling`, {
        verificationNumber,
        token: token || undefined, // Only send if provided
        startDate,
        endDate,
        gender,
        searchNames: searchNames.filter(name => name.trim() !== ''),
        intervalMinutes: parseInt(intervalMinutes.toString())
      });

      setCurrentJobId(response.data.jobId);
      setAutoRefresh(true);
      await fetchJobStatus(response.data.jobId);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to start polling');
    } finally {
      setLoading(false);
    }
  };

  const handleStopPolling = async () => {
    if (!currentJobId) return;

    try {
      await axios.delete(`${API_BASE_URL}/api/job/${currentJobId}`);
      setAutoRefresh(false);
      setCurrentJobId(null);
      setJobStatus(null);
      // Don't reset form inputs - keep dates, name, etc.
      // Only reset the job-related state
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to stop polling');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="container">
      <h1 style={{ marginBottom: '30px', color: '#333' }}>Death Certificate Search</h1>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      <div className="card">
        <h2 style={{ marginBottom: '20px' }}>Configuration</h2>
        <form onSubmit={handleStartPolling}>
          <div className="grid">
            <div className="form-group">
              <label htmlFor="verificationNumber">Verification Number (optional - will be auto-extracted if not provided)</label>
              <input
                id="verificationNumber"
                type="text"
                value={verificationNumber}
                onChange={(e) => setVerificationNumber(e.target.value)}
                placeholder="Leave empty to auto-extract from website"
                disabled={loading || !!currentJobId}
              />
              <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '4px' }}>
                If you see a verification number on the website, you can enter it here. Otherwise, the system will automatically extract it.
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="token">Token (optional - will be auto-fetched if not provided)</label>
              <input
                id="token"
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Leave empty to auto-fetch from session"
                disabled={loading || !!currentJobId}
              />
              <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '4px' }}>
                If you have a token from the website, you can enter it here. Otherwise, the system will automatically fetch it.
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="startDate">Start Date *</label>
              <input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                disabled={loading || !!currentJobId}
              />
            </div>

            <div className="form-group">
              <label htmlFor="endDate">End Date *</label>
              <input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                disabled={loading || !!currentJobId}
              />
            </div>

            <div className="form-group">
              <label htmlFor="gender">Gender</label>
              <select
                id="gender"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                disabled={loading || !!currentJobId}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="intervalMinutes">Poll Interval (minutes)</label>
              <input
                id="intervalMinutes"
                type="number"
                value={intervalMinutes}
                onChange={(e) => setIntervalMinutes(parseInt(e.target.value) || 60)}
                min="1"
                disabled={loading || !!currentJobId}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Search Names (optional)</label>
            {searchNames.map((name, index) => (
              <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    const newNames = [...searchNames];
                    newNames[index] = e.target.value;
                    setSearchNames(newNames);
                  }}
                  placeholder={`Enter name ${index + 1} to search for`}
                  disabled={loading || !!currentJobId}
                  style={{ flex: 1 }}
                />
                {searchNames.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchNames(searchNames.filter((_, i) => i !== index));
                    }}
                    disabled={loading || !!currentJobId}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setSearchNames([...searchNames, ''])}
              disabled={loading || !!currentJobId}
              style={{
                marginTop: '8px',
                padding: '8px 16px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              + Add Another Name
            </button>
          </div>

          <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
            {!currentJobId ? (
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Starting...' : 'Start Polling'}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleStopPolling}
              >
                Stop Polling
              </button>
            )}
          </div>
        </form>
      </div>

      {jobStatus && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2>Job Status</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {jobStatus.retryingErrors && (
                <span className="alert alert-info" style={{ 
                  padding: '4px 12px', 
                  borderRadius: '4px',
                  fontSize: '14px',
                  backgroundColor: '#e3f2fd',
                  color: '#1976d2',
                  border: '1px solid #90caf9'
                }}>
                  🔄 Retrying error dates...
                </span>
              )}
              <span className={`status-badge status-${jobStatus.status}`}>
                {jobStatus.status.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="grid" style={{ marginBottom: '20px' }}>
            <div>
              <strong>Job ID:</strong> {jobStatus.jobId}
            </div>
            <div>
              <strong>Start Time:</strong> {formatDate(jobStatus.startTime)}
            </div>
            <div>
              <strong>Last Update:</strong> {jobStatus.lastUpdate ? formatDate(jobStatus.lastUpdate) : 'N/A'}
            </div>
            <div>
              <strong>Total Requests:</strong> {jobStatus.totalRequests}
            </div>
            {(jobStatus.searchName || (jobStatus.searchNames && jobStatus.searchNames.length > 0)) && (
              <div>
                <strong>Searching for:</strong> {
                  jobStatus.searchNames && jobStatus.searchNames.length > 0
                    ? jobStatus.searchNames.join(', ')
                    : jobStatus.searchName
                }
              </div>
            )}
            {(jobStatus.searchName || (jobStatus.searchNames && jobStatus.searchNames.length > 0)) && (
              <div>
                <strong>Found Dates:</strong> {jobStatus.foundDates.length}
              </div>
            )}
          </div>

          {jobStatus.errors.length > 0 && (
            <div className="alert alert-error" style={{ marginBottom: '20px' }}>
              <strong>Errors ({jobStatus.errors.length}):</strong>
              {jobStatus.errorDates && jobStatus.errorDates.length > 0 && (
                <div style={{ marginTop: '8px', marginBottom: '8px', padding: '8px', backgroundColor: '#fff3cd', borderRadius: '4px' }}>
                  <strong>Error dates to retry: {jobStatus.errorDates.length}</strong>
                  {jobStatus.retryingErrors && (
                    <div style={{ marginTop: '4px', color: '#1976d2' }}>
                      Currently retrying: {jobStatus.errorDates.join(', ')}
                    </div>
                  )}
                </div>
              )}
              <ul style={{ marginTop: '8px', marginLeft: '20px' }}>
                {jobStatus.errors.slice(-10).map((err, idx) => (
                  <li key={idx}>
                    {err.date}: {err.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(jobStatus.searchName || (jobStatus.searchNames && jobStatus.searchNames.length > 0)) && jobStatus.foundDates.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <h3 style={{ marginBottom: '16px' }}>
                Found Records for "{jobStatus.searchNames && jobStatus.searchNames.length > 0 ? jobStatus.searchNames.join(', ') : jobStatus.searchName}" 
                <span style={{ fontSize: '14px', fontWeight: 'normal', color: '#666', marginLeft: '10px' }}>
                  ({jobStatus.foundDates.length} date{jobStatus.foundDates.length !== 1 ? 's' : ''} with matches)
                </span>
              </h3>
              {jobStatus.foundDates.map((found, idx) => (
                <div key={idx} style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                  <h4 style={{ marginBottom: '12px', color: '#4a90e2' }}>
                    Date: {found.date}
                    {found.totalRecordsOnDate && (
                      <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#666', marginLeft: '10px' }}>
                        ({found.records.length} match{found.records.length !== 1 ? 'es' : ''} out of {found.totalRecordsOnDate} total records)
                      </span>
                    )}
                  </h4>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Gender</th>
                        <th>Date of Death</th>
                        <th>Father's Name</th>
                        <th>Mother's Name</th>
                      </tr>
                    </thead>
                    <tbody>
                      {found.records.map((record, recordIdx) => {
                        // Highlight the matched name
                        const highlightName = (name: string, searchName: string) => {
                          if (!name || !searchName) return name;
                          const normalizedName = name.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ');
                          const normalizedSearch = searchName.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ');
                          
                          if (normalizedName.includes(normalizedSearch)) {
                            // Find the matching part in original case
                            const searchWords = searchName.split(/\s+/).filter(w => w.length > 0);
                            let highlighted = name;
                            
                            // Try to highlight the matching part
                            const nameLower = name.toLowerCase().replace(/\./g, '');
                            const searchLower = searchName.toLowerCase().replace(/\./g, '');
                            const index = nameLower.indexOf(searchLower);
                            
                            if (index >= 0) {
                              // Find the actual text to highlight (accounting for dots)
                              let charIndex = 0;
                              let dotCount = 0;
                              for (let i = 0; i < name.length && charIndex < index; i++) {
                                if (name[i] === '.') dotCount++;
                                else charIndex++;
                              }
                              
                              const start = Math.max(0, index + dotCount - searchName.length);
                              const end = Math.min(name.length, start + searchName.length + 5);
                              const before = name.substring(0, start);
                              const match = name.substring(start, end);
                              const after = name.substring(end);
                              
                              return (
                                <>
                                  {before}
                                  <span style={{ backgroundColor: '#ffeb3b', fontWeight: 'bold', padding: '2px 4px', borderRadius: '2px' }}>
                                    {match}
                                  </span>
                                  {after}
                                </>
                              );
                            }
                          }
                          
                          // Word-by-word highlighting
                          const nameWords = name.split(/\s+|\./).filter(w => w.length > 0);
                          const searchWords = searchName.split(/\s+|\./).filter(w => w.length > 0);
                          
                          return nameWords.map((word, idx) => {
                            const wordLower = word.toLowerCase();
                            const isMatch = searchWords.some(sw => 
                              wordLower.includes(sw.toLowerCase()) || sw.toLowerCase().includes(wordLower)
                            );
                            
                            if (isMatch) {
                              return (
                                <span key={idx}>
                                  <span style={{ backgroundColor: '#ffeb3b', fontWeight: 'bold', padding: '2px 4px', borderRadius: '2px' }}>
                                    {word}
                                  </span>
                                  {idx < nameWords.length - 1 ? ' ' : ''}
                                </span>
                              );
                            }
                            return <span key={idx}>{word}{idx < nameWords.length - 1 ? ' ' : ''}</span>;
                          });
                        };
                        
                        return (
                          <tr key={recordIdx} style={{ backgroundColor: '#fff' }}>
                            <td>
                              <strong>
                                {record.matchedField === 'name' 
                                  ? highlightName(record.name, jobStatus.searchName || '')
                                  : record.name
                                }
                              </strong>
                              {record.matchScore && (
                                <span style={{ fontSize: '10px', color: '#666', marginLeft: '8px' }}>
                                  ({Math.round(record.matchScore)}% match)
                                </span>
                              )}
                            </td>
                            <td>{record.gender}</td>
                            <td>{record.dateOfDeath}</td>
                            <td>
                              {record.matchedField === 'fathersName' 
                                ? highlightName(record.fathersName, jobStatus.searchName || '')
                                : record.fathersName
                              }
                            </td>
                            <td>
                              {record.matchedField === 'mothersName' 
                                ? highlightName(record.mothersName, jobStatus.searchName || '')
                                : record.mothersName
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {(jobStatus.searchName || (jobStatus.searchNames && jobStatus.searchNames.length > 0)) && jobStatus.foundDates.length === 0 && jobStatus.totalRequests > 0 && (
            <div className="alert alert-info" style={{ marginTop: '20px' }}>
              No matches found for "{(jobStatus.searchNames && jobStatus.searchNames.length > 0 ? jobStatus.searchNames.join(', ') : jobStatus.searchName)}" so far. Searching in progress...
            </div>
          )}

          {jobStatus.allRecords.length > 0 && !jobStatus.searchName && (!jobStatus.searchNames || jobStatus.searchNames.length === 0) && (
            <div style={{ marginTop: '20px' }}>
              <h3 style={{ marginBottom: '16px' }}>All Records ({jobStatus.allRecords.length})</h3>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Name</th>
                      <th>Gender</th>
                      <th>Date of Death</th>
                      <th>Father's Name</th>
                      <th>Mother's Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobStatus.allRecords.map((record, idx) => (
                      <tr key={idx}>
                        <td>{record.date}</td>
                        <td>{record.name}</td>
                        <td>{record.gender}</td>
                        <td>{record.dateOfDeath}</td>
                        <td>{record.fathersName}</td>
                        <td>{record.mothersName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {jobStatus.allRecords.length === 0 && jobStatus.totalRequests > 0 && (
            <div className="alert alert-info">
              No records found yet. Polling in progress...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

