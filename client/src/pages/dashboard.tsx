import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { ProjectCard } from "@/components/ProjectCard";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Plus } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import type { Project } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  
  // If not authenticated, redirect to login
  useEffect(() => {
    if (!user) {
      navigate("/");
    }
  }, [user, navigate]);

  // Fetch projects
  const { data: projects, isLoading, error } = useQuery({
    queryKey: ["/api/projects"],
    enabled: !!user
  });

  // Delete project mutation
  const deleteMutation = useMutation({
    mutationFn: async (projectId: number) => {
      return await apiRequest("DELETE", `/api/projects/${projectId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
  });

  const handleCreateProject = () => {
    navigate("/create-project");
  };

  const handleDeleteProject = (projectId: number) => {
    if (window.confirm("Are you sure you want to delete this project?")) {
      deleteMutation.mutate(projectId);
    }
  };

  if (!user) {
    return null; // Don't render if not authenticated
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header />

      <main className="flex-1 overflow-auto">
        <div className="py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
            <h1 className="text-2xl font-semibold text-gray-900">My AR Projects</h1>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
            <div className="mt-8">
              <div className="flex flex-col">
                <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
                  <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {/* Create New Project Card */}
                      <div
                        className="relative rounded-lg border-2 border-dashed border-gray-300 p-8 h-64 flex items-center justify-center hover:border-primary transition-colors group cursor-pointer"
                        onClick={handleCreateProject}
                      >
                        <div className="text-center">
                          <Plus className="mx-auto h-12 w-12 text-gray-400 group-hover:text-primary" />
                          <span className="mt-2 block text-sm font-medium text-gray-900">
                            Create new project
                          </span>
                        </div>
                      </div>

                      {/* Loading State */}
                      {isLoading && (
                        <>
                          <div className="bg-white overflow-hidden shadow rounded-lg">
                            <div className="aspect-w-16 aspect-h-9">
                              <Skeleton className="h-full w-full" />
                            </div>
                            <div className="px-4 py-5 sm:p-6">
                              <div className="flex justify-between">
                                <div>
                                  <Skeleton className="h-6 w-32" />
                                  <Skeleton className="h-4 w-24 mt-1" />
                                </div>
                                <Skeleton className="h-6 w-16 rounded-full" />
                              </div>
                              <div className="mt-4">
                                <Skeleton className="h-4 w-40" />
                              </div>
                            </div>
                            <div className="bg-gray-50 px-4 py-4 sm:px-6 border-t border-gray-200">
                              <div className="flex justify-between">
                                <div className="flex space-x-2">
                                  <Skeleton className="h-8 w-20" />
                                  <Skeleton className="h-8 w-20" />
                                </div>
                                <Skeleton className="h-8 w-20" />
                              </div>
                            </div>
                          </div>
                          <div className="bg-white overflow-hidden shadow rounded-lg">
                            <div className="aspect-w-16 aspect-h-9">
                              <Skeleton className="h-full w-full" />
                            </div>
                            <div className="px-4 py-5 sm:p-6">
                              <div className="flex justify-between">
                                <div>
                                  <Skeleton className="h-6 w-32" />
                                  <Skeleton className="h-4 w-24 mt-1" />
                                </div>
                                <Skeleton className="h-6 w-16 rounded-full" />
                              </div>
                              <div className="mt-4">
                                <Skeleton className="h-4 w-40" />
                              </div>
                            </div>
                            <div className="bg-gray-50 px-4 py-4 sm:px-6 border-t border-gray-200">
                              <div className="flex justify-between">
                                <div className="flex space-x-2">
                                  <Skeleton className="h-8 w-20" />
                                  <Skeleton className="h-8 w-20" />
                                </div>
                                <Skeleton className="h-8 w-20" />
                              </div>
                            </div>
                          </div>
                        </>
                      )}

                      {/* Error State */}
                      {error && (
                        <div className="col-span-full p-4 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-red-600">
                            Failed to load projects. Please try again later.
                          </p>
                        </div>
                      )}

                      {/* Project Cards */}
                      {Array.isArray(projects) && projects.map((project: Project) => (
                        <ProjectCard
                          key={project.id}
                          project={project}
                          onDelete={() => handleDeleteProject(project.id)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
