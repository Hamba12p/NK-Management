'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Archive, History, Clock, Download, Share2 } from 'lucide-react';

interface DocumentHistory {
  id: string;
  file_name: string;
  file_size: number;
  uploaded_by: string;
  created_at: string;
  category: string;
  version: number;
}

export default function AdvancedPage() {
  const supabase = createClient();
  const [documents, setDocuments] = useState<DocumentHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'history' | 'exports'>('history');

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const { data } = await supabase
          .from('documents')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (data) {
          const mapped = data.map((doc, idx) => ({
            id: doc.id,
            file_name: doc.name,
            file_size: doc.file_size || 0,
            uploaded_by: doc.uploaded_by || 'Unknown',
            created_at: doc.created_at,
            category: doc.category,
            version: data.length - idx,
          }));
          setDocuments(mapped);
        }
      } catch (err) {
        console.error('Failed to fetch documents:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, []);

  const handleExport = async (format: 'json' | 'csv') => {
    const dataStr = format === 'json' 
      ? JSON.stringify(documents, null, 2)
      : ['File Name,Category,Size,Uploaded By,Date', ...documents.map(d => 
          `"${d.file_name}","${d.category}","${d.file_size}","${d.uploaded_by}","${d.created_at}"`)
        ].join('\n');
    
    const dataUri = `data:text/${format === 'json' ? 'json' : 'csv'};charset=utf-8,${encodeURIComponent(dataStr)}`;
    const exportFileDefaultName = `documents-export-${new Date().toISOString().split('T')[0]}.${format}`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
        <div className="max-w-4xl mx-auto flex items-center justify-center min-h-96">
          <div className="text-slate-600 text-lg">Loading advanced features...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2 flex items-center gap-3">
            <Archive className="w-8 h-8 text-pink-600" />
            Advanced Features
          </h1>
          <p className="text-slate-600">Document versioning, export, and sharing tools.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 px-4 font-semibold transition-colors ${
              activeTab === 'history'
                ? 'text-pink-600 border-b-2 border-pink-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4 inline mr-2" />
            Document History
          </button>
          <button
            onClick={() => setActiveTab('exports')}
            className={`pb-3 px-4 font-semibold transition-colors ${
              activeTab === 'exports'
                ? 'text-pink-600 border-b-2 border-pink-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Download className="w-4 h-4 inline mr-2" />
            Export & Sharing
          </button>
        </div>

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {documents.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-12 text-center">
              <History className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600">No document history available</p>
              </div>
            ) : (
              documents.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-900 truncate">{doc.file_name}</h3>
                      <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                        <span className="bg-pink-100 text-pink-800 px-2 py-1 rounded">
                          v{doc.version}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {new Date(doc.created_at).toLocaleDateString()}
                        </span>
                        <span>{(doc.file_size / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Category</p>
                      <p className="font-semibold text-slate-900">{doc.category}</p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600">
                    Uploaded by {doc.uploaded_by}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {/* Export Tab */}
        {activeTab === 'exports' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Export Data</h2>
              <p className="text-slate-600 mb-6">Download your documents list in various formats</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => handleExport('json')}
                  className="flex items-center justify-center gap-3 p-4 bg-slate-50 hover:bg-slate-100 rounded-lg border border-gray-200 transition-colors"
                >
                  <Download className="w-5 h-5 text-pink-600" />
                  <div className="text-left">
                    <p className="font-semibold text-slate-900">JSON Export</p>
                    <p className="text-sm text-slate-600">For data analysis</p>
                  </div>
                </button>
                <button
                  onClick={() => handleExport('csv')}
                  className="flex items-center justify-center gap-3 p-4 bg-slate-50 hover:bg-slate-100 rounded-lg border border-gray-200 transition-colors"
                >
                  <Download className="w-5 h-5 text-pink-600" />
                  <div className="text-left">
                    <p className="font-semibold text-slate-900">CSV Export</p>
                    <p className="text-sm text-slate-600">For spreadsheets</p>
                  </div>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Sharing Options</h2>
              <p className="text-slate-600 mb-6">Share documents with team members</p>
              <div className="space-y-3">
                <button className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors">
                  <div className="text-left">
                    <p className="font-semibold text-slate-900">Share via Link</p>
                    <p className="text-sm text-slate-600">Create a shareable document link</p>
                  </div>
                  <Share2 className="w-5 h-5 text-slate-400" />
                </button>
                <button className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors">
                  <div className="text-left">
                    <p className="font-semibold text-slate-900">Share with Team</p>
                    <p className="text-sm text-slate-600">Send to specific team members</p>
                  </div>
                  <Share2 className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
