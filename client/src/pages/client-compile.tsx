import { useState } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileUp, Download, Image, Info } from "lucide-react";
import { MindFileGenerator } from "@/components/FixedMindFileGenerator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ClientCompile() {
  const [targetImage, setTargetImage] = useState<File | null>(null);
  const [mindFileUrl, setMindFileUrl] = useState<string | null>(null);
  const [visualMode, setVisualMode] = useState<'basic' | 'analyze'>('basic');
  
  // Handle image file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      console.log("[ClientCompile] File selected:", files[0].name);
      setTargetImage(files[0]);
      setMindFileUrl(null);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      
      <main className="container mx-auto py-10 px-4 flex-1">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">Client-side Compiler</h1>
          <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-2xl">
            Biên dịch hình ảnh thành file .mind trực tiếp trong trình duyệt. 
            Công cụ này sẽ hiển thị các điểm đặc trưng (feature points) được trích xuất từ hình ảnh
            và cho phép bạn visualize chúng để đánh giá khả năng nhận diện.
          </p>
          
          <Alert className="mb-6 bg-blue-50 border-blue-200 text-blue-800">
            <Info className="h-4 w-4" />
            <AlertTitle>Đây là công cụ phân tích</AlertTitle>
            <AlertDescription>
              Khi tạo dự án AR, hệ thống sẽ tự động biên dịch file .mind cho bạn. 
              Công cụ này giúp bạn đánh giá chất lượng hình ảnh trước khi sử dụng.
            </AlertDescription>
          </Alert>
          
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Image className="h-5 w-5 text-primary" />
                    <span>Hình ảnh mục tiêu</span>
                  </CardTitle>
                  <CardDescription>
                    Tải lên hình ảnh bạn muốn sử dụng làm marker trong AR
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  {/* File input */}
                  <div>
                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-md p-6 transition-colors hover:border-primary/50">
                      <input
                        type="file"
                        id="target-image"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                      
                      <FileUp className="h-8 w-8 text-slate-400 mb-3" />
                      
                      <p className="text-sm font-medium mb-1 text-center">
                        {targetImage ? targetImage.name : "Chọn hình ảnh mục tiêu"}
                      </p>
                      
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 text-center max-w-xs">
                        Hình ảnh có nhiều chi tiết, không quá đơn giản, và đủ độ tương phản sẽ cho kết quả tốt nhất.
                      </p>
                      
                      <Button size="sm" onClick={() => document.getElementById('target-image')?.click()}>
                        {targetImage ? "Chọn hình ảnh khác" : "Tải lên hình ảnh"}
                      </Button>
                    </div>
                  </div>
                  
                  {targetImage && (
                    <div>
                      <h3 className="text-sm font-medium mb-2">Xem trước hình ảnh:</h3>
                      <div className="relative border rounded-md overflow-hidden">
                        <img 
                          src={URL.createObjectURL(targetImage)} 
                          alt="Xem trước hình ảnh mục tiêu"
                          className="w-full h-auto object-contain"
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            
            <div className="lg:col-span-3">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileUp className="h-5 w-5 text-primary" />
                    <span>Biên dịch .mind File</span>
                  </CardTitle>
                  <CardDescription>
                    Trích xuất feature points và tạo file .mind từ hình ảnh
                  </CardDescription>
                </CardHeader>
                
                <CardContent>
                  {!targetImage ? (
                    <div className="h-48 flex items-center justify-center border rounded-md bg-slate-50 dark:bg-slate-900">
                      <p className="text-slate-500 dark:text-slate-400 text-center px-6">
                        Vui lòng tải lên hình ảnh để bắt đầu quá trình biên dịch.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <Tabs 
                        value={visualMode} 
                        onValueChange={(v) => setVisualMode(v as 'basic' | 'analyze')}
                        className="w-full"
                      >
                        <TabsList className="grid w-full grid-cols-2 mb-4">
                          <TabsTrigger value="basic">Cơ bản</TabsTrigger>
                          <TabsTrigger value="analyze">Phân tích</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="basic">
                          <MindFileGenerator 
                            targetImage={targetImage}
                            onMindFileGenerated={(url) => {
                              console.log("[ClientCompile] Mind file generated:", url);
                              setMindFileUrl(url);
                            }}
                            className="mt-2"
                          />
                          
                          <div className="mt-6 pt-4 border-t">
                            <h3 className="text-sm font-medium mb-2">Thông tin kỹ thuật:</h3>
                            <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1 ml-5 list-disc">
                              <li>Biên dịch hoàn toàn tại client-side, không gửi hình ảnh lên server</li>
                              <li>Sử dụng thuật toán trích xuất đặc điểm FAST (Features from Accelerated Segment Test)</li>
                              <li>Hiển thị điểm đặc trưng: màu đỏ = điểm quan trọng nhất, màu xanh = điểm thứ cấp</li>
                              <li>Độ phức tạp càng cao của hình ảnh sẽ cho kết quả nhận diện càng tốt</li>
                            </ul>
                          </div>
                        </TabsContent>
                        
                        <TabsContent value="analyze">
                          <div className="space-y-4">
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              Mode phân tích sẽ hiển thị chi tiết hơn về các điểm đặc trưng và chất lượng của hình ảnh mục tiêu.
                              Bạn có thể dùng công cụ này để đánh giá xem hình ảnh có phù hợp làm marker AR hay không.
                            </p>
                            
                            <MindFileGenerator 
                              targetImage={targetImage}
                              onMindFileGenerated={(url) => {
                                console.log("[ClientCompile] Mind file generated in analyze mode:", url);
                                setMindFileUrl(url);
                              }}
                            />
                            
                            <div className="mt-4 pt-4 border-t space-y-2">
                              <h3 className="text-sm font-medium">Cách đánh giá chất lượng hình ảnh:</h3>
                              <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1 ml-5 list-disc">
                                <li><span className="font-medium text-red-600">Điểm đỏ</span>: Đây là những điểm quan trọng nhất, nên phân bố đều trên toàn bộ hình ảnh</li>
                                <li><span className="font-medium text-green-600">Điểm xanh</span>: Điểm thứ cấp, hỗ trợ thêm trong quá trình nhận diện</li>
                                <li>Một hình ảnh tốt nên có ít nhất 100 điểm đặc trưng phân bố đều</li>
                                <li>Nên tránh hình ảnh quá trơn (như logo đơn giản) hoặc hoa văn lặp lại</li>
                              </ul>
                            </div>
                          </div>
                        </TabsContent>
                      </Tabs>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}