
import React, { useState, useContext, useMemo, useRef, useEffect, useCallback } from 'react';
import { AppContext } from '../../App';
import type { Resource, User } from '../../types';
import { ResourceType, SemesterIntake } from '../../types';
import ResourceCard from '../ResourceCard';
import UserCard from '../UserCard';
import { Search, Filter, X, ChevronDown, ChevronUp, Database, Loader2 } from 'lucide-react';

interface ActiveFilters {
  resourceTypes: Set<ResourceType>;
  years: Set<number>;
  semesters: Set<SemesterIntake>;
  lecturers: Set<string>;
  courses: Set<string>;
}

const DashboardPage: React.FC = () => {
  const { resources, users, setView, areResourcesLoading } = useContext(AppContext);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({
    resourceTypes: new Set(),
    years: new Set(),
    semesters: new Set(),
    lecturers: new Set(),
    courses: new Set(),
  });

  // Extract unique values for filter options
  const filterOptions = useMemo(() => {
    const years = new Set<number>();
    const lecturers = new Set<string>();
    const courses = new Set<string>();
    resources.forEach(r => {
      years.add(r.year);
      if (r.lecturer) lecturers.add(r.lecturer);
      courses.add(r.courseCode);
    });
    return {
      years: Array.from(years).sort((a, b) => b - a),
      lecturers: Array.from(lecturers).sort(),
      courses: Array.from(courses).sort(),
    };
  }, [resources]);

  const toggleFilter = useCallback(<K extends keyof ActiveFilters>(
    category: K,
    value: ActiveFilters[K] extends Set<infer U> ? U : never
  ) => {
    setActiveFilters(prev => {
      // Type assertion needed because TypeScript struggles with union of Sets in constructor
      const newSet = new Set(prev[category] as Set<any>);
      if (newSet.has(value)) {
        newSet.delete(value);
      } else {
        newSet.add(value);
      }
      return { ...prev, [category]: newSet };
    });
  }, []);

  const clearFilters = () => {
    setActiveFilters({
      resourceTypes: new Set(),
      years: new Set(),
      semesters: new Set(),
      lecturers: new Set(),
      courses: new Set(),
    });
  };

  const activeFilterCount = Object.values(activeFilters).reduce((acc: number, set: Set<any>) => acc + set.size, 0);

  const filteredResources = useMemo((): Resource[] => {
    return resources.filter(resource => {
      // 1. Search Term Filter
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        resource.title.toLowerCase().includes(searchLower) ||
        resource.courseCode.toLowerCase().includes(searchLower) ||
        resource.courseName.toLowerCase().includes(searchLower) ||
        resource.author.name.toLowerCase().includes(searchLower) ||
        (resource.lecturer && resource.lecturer.toLowerCase().includes(searchLower));

      if (!matchesSearch) return false;

      // 2. Faceted Filters
      if (activeFilters.resourceTypes.size > 0 && !activeFilters.resourceTypes.has(resource.type)) return false;
      if (activeFilters.years.size > 0 && !activeFilters.years.has(resource.year)) return false;
      if (activeFilters.semesters.size > 0 && !activeFilters.semesters.has(resource.semester)) return false;
      if (activeFilters.lecturers.size > 0 && (!resource.lecturer || !activeFilters.lecturers.has(resource.lecturer))) return false;
      if (activeFilters.courses.size > 0 && !activeFilters.courses.has(resource.courseCode)) return false;

      return true;
    });
  }, [resources, searchTerm, activeFilters]);

  const filteredUsers = useMemo<User[]>(() => {
      if (!searchTerm) return [];
      const term = searchTerm.toLowerCase();
      return users.filter(u => u.name.toLowerCase().includes(term) || u.course.toLowerCase().includes(term));
  }, [users, searchTerm]);

  const hasResourceResults = filteredResources.length > 0;
  const hasUserResults = filteredUsers.length > 0;

  const handleAuthorClick = (authorId: string) => {
      setView('publicProfile', authorId);
  };

  const isEmptyDatabase = resources.length === 0;

  return (
    <div>
      {/* Search and Filter Bar */}
      <div className="sticky top-20 z-10 bg-slate-50 dark:bg-dark-bg pt-2 pb-6 transition-colors duration-300">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              id="tour-search-bar"
              type="text"
              placeholder="Search by title, course code, or lecturer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-dark-surface dark:text-white dark:border-zinc-700 pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm transition-all"
            />
          </div>
          <button
            id="tour-filter-button"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all shadow-sm ${
              isFilterOpen || activeFilterCount > 0
                ? 'bg-primary-600 text-white shadow-primary-500/30'
                : 'bg-white dark:bg-dark-surface text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700'
            }`}
          >
            <Filter size={20} />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="bg-white text-primary-600 px-2 py-0.5 rounded-full text-xs font-bold ml-1">
                {activeFilterCount}
              </span>
            )}
            {isFilterOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {/* Filter Panel */}
        {isFilterOpen && (
          <div className="mt-4 bg-white dark:bg-dark-surface p-6 rounded-xl shadow-lg border border-slate-100 dark:border-zinc-700 animate-in slide-in-from-top-2">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 dark:text-white">Filter Resources</h3>
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="text-sm text-red-500 hover:text-red-700 font-semibold">
                  Clear All
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              {/* Resource Type */}
              <div>
                <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">Type</h4>
                <div className="space-y-2">
                  {Object.values(ResourceType).map(type => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer group">
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition ${activeFilters.resourceTypes.has(type) ? 'bg-primary-600 border-primary-600' : 'border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800'}`}>
                        {activeFilters.resourceTypes.has(type) && <X size={14} className="text-white" />}
                      </div>
                      <input 
                        type="checkbox" 
                        className="hidden" 
                        checked={activeFilters.resourceTypes.has(type)}
                        onChange={() => toggleFilter('resourceTypes', type)}
                      />
                      <span className={`text-sm group-hover:text-primary-600 dark:group-hover:text-primary-400 transition ${activeFilters.resourceTypes.has(type) ? 'font-semibold text-slate-800 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Semester */}
              <div>
                <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">Intake</h4>
                <div className="space-y-2">
                  {Object.values(SemesterIntake).map(sem => (
                    <label key={sem} className="flex items-center gap-2 cursor-pointer group">
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition ${activeFilters.semesters.has(sem) ? 'bg-primary-600 border-primary-600' : 'border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800'}`}>
                        {activeFilters.semesters.has(sem) && <X size={14} className="text-white" />}
                      </div>
                      <input 
                        type="checkbox" 
                        className="hidden" 
                        checked={activeFilters.semesters.has(sem)}
                        onChange={() => toggleFilter('semesters', sem)}
                      />
                      <span className={`text-sm group-hover:text-primary-600 dark:group-hover:text-primary-400 transition ${activeFilters.semesters.has(sem) ? 'font-semibold text-slate-800 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>{sem}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Year */}
              <div>
                <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">Year</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                  {filterOptions.years.map(year => (
                    <label key={year} className="flex items-center gap-2 cursor-pointer group">
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition ${activeFilters.years.has(year) ? 'bg-primary-600 border-primary-600' : 'border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800'}`}>
                        {activeFilters.years.has(year) && <X size={14} className="text-white" />}
                      </div>
                      <input 
                        type="checkbox" 
                        className="hidden" 
                        checked={activeFilters.years.has(year)}
                        onChange={() => toggleFilter('years', year)}
                      />
                      <span className={`text-sm group-hover:text-primary-600 dark:group-hover:text-primary-400 transition ${activeFilters.years.has(year) ? 'font-semibold text-slate-800 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>{year}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Course */}
              <div>
                <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">Course</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                  {filterOptions.courses.map(course => (
                    <label key={course} className="flex items-center gap-2 cursor-pointer group">
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition ${activeFilters.courses.has(course) ? 'bg-primary-600 border-primary-600' : 'border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800'}`}>
                        {activeFilters.courses.has(course) && <X size={14} className="text-white" />}
                      </div>
                      <input 
                        type="checkbox" 
                        className="hidden" 
                        checked={activeFilters.courses.has(course)}
                        onChange={() => toggleFilter('courses', course)}
                      />
                      <span className={`text-sm group-hover:text-primary-600 dark:group-hover:text-primary-400 transition ${activeFilters.courses.has(course) ? 'font-semibold text-slate-800 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>{course}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Lecturer */}
              <div>
                <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">Lecturer</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                  {filterOptions.lecturers.map(lecturer => (
                    <label key={lecturer} className="flex items-center gap-2 cursor-pointer group">
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition ${activeFilters.lecturers.has(lecturer) ? 'bg-primary-600 border-primary-600' : 'border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800'}`}>
                        {activeFilters.lecturers.has(lecturer) && <X size={14} className="text-white" />}
                      </div>
                      <input 
                        type="checkbox" 
                        className="hidden" 
                        checked={activeFilters.lecturers.has(lecturer)}
                        onChange={() => toggleFilter('lecturers', lecturer)}
                      />
                      <span className={`text-sm group-hover:text-primary-600 dark:group-hover:text-primary-400 transition ${activeFilters.lecturers.has(lecturer) ? 'font-semibold text-slate-800 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>{lecturer}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Loading State */}
      {areResourcesLoading && (
        <div className="flex flex-col items-center justify-center py-20">
            <Loader2 size={48} className="animate-spin text-primary-500 mb-4" />
            <p className="text-slate-500 dark:text-slate-400 font-medium">Loading resources...</p>
        </div>
      )}

      {/* Empty State / Database Setup - Only show if NOT loading */}
      {isEmptyDatabase && !searchTerm && !areResourcesLoading && (
        <div className="bg-white dark:bg-dark-surface rounded-xl shadow-md p-8 text-center border border-dashed border-slate-300 dark:border-zinc-700">
            <Database size={48} className="mx-auto text-slate-400 dark:text-slate-500 mb-4" />
            <h3 className="text-xl font-bold text-slate-800 dark:text-white">Database is Empty</h3>
            <p className="text-slate-600 dark:text-slate-400 mt-2 mb-6 max-w-md mx-auto">
                Your ExamVault is currently empty. Upload a resource to get started!
            </p>
        </div>
      )}

      {/* User Search Results */}
      {hasUserResults && (
        <div className="mb-8">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Users</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredUsers.map(user => (
              <UserCard key={user.id} user={user} onSelect={() => setView('publicProfile', user.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Resource Grid */}
      <div className="mb-8">
        {hasResourceResults && (
             <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">
                {searchTerm || activeFilterCount > 0 ? 'Search Results' : 'All Resources'}
            </h2>
        )}
        
        {hasResourceResults ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredResources.map(resource => (
              <ResourceCard 
                key={resource.id} 
                resource={resource} 
                onSelect={() => setView('resourceDetail', resource.id)} 
                onAuthorClick={handleAuthorClick}
              />
            ))}
          </div>
        ) : (
          !hasUserResults && !isEmptyDatabase && !areResourcesLoading && (
            <div className="text-center py-20 bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-slate-100 dark:border-zinc-700">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 dark:bg-zinc-800 rounded-full mb-4">
                <Search size={32} className="text-slate-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">No matches found</h3>
              <p className="text-slate-500 dark:text-slate-400 mt-1">Try adjusting your search or filters</p>
              <button 
                onClick={() => { setSearchTerm(''); clearFilters(); }}
                className="mt-4 text-primary-600 dark:text-primary-400 font-semibold hover:text-primary-800 dark:hover:text-primary-300"
              >
                Clear all filters
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
