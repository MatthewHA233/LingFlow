'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Book, Clock, Users } from 'lucide-react';

interface Course {
  id: string;
  title: string;
  description: string;
  level: string;
  duration: string;
  enrolledCount: number;
  progress: number;
  imageUrl: string;
}

const MOCK_COURSES: Course[] = [
  {
    id: '1',
    title: '日语初级会话课程',
    description: '从零开始学习日常会话，掌握基础语法和常用词汇',
    level: '初级',
    duration: '3个月',
    enrolledCount: 1234,
    progress: 0,
    imageUrl: 'https://images.unsplash.com/photo-1480796927426-f609979314bd'
  },
  {
    id: '2',
    title: '商务英语进阶',
    description: '针对职场场景的英语交流技巧和专业词汇',
    level: '中级',
    duration: '2个月',
    enrolledCount: 856,
    progress: 0,
    imageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab'
  },
  {
    id: '3',
    title: '韩语发音精讲',
    description: '系统学习韩语发音规则，纠正发音问题',
    level: '初级',
    duration: '1个月',
    enrolledCount: 567,
    progress: 0,
    imageUrl: 'https://images.unsplash.com/photo-1517154421773-0529f29ea451'
  }
];

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    // 模拟API加载
    setCourses(MOCK_COURSES);
  }, []);

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">语言课程</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((course) => (
          <Card key={course.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            <div className="aspect-video relative overflow-hidden">
              <img
                src={course.imageUrl}
                alt={course.title}
                className="object-cover w-full h-full transform hover:scale-105 transition-transform duration-300"
              />
              <Badge className="absolute top-2 right-2">{course.level}</Badge>
            </div>
            
            <CardHeader>
              <CardTitle>{course.title}</CardTitle>
              <CardDescription>{course.description}</CardDescription>
            </CardHeader>
            
            <CardContent>
              <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{course.duration}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span>{course.enrolledCount}人已报名</span>
                </div>
              </div>
              
              {course.progress > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>学习进度</span>
                    <span>{course.progress}%</span>
                  </div>
                  <Progress value={course.progress} />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}