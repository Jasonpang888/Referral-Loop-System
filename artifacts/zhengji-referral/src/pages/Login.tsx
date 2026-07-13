import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const loginMutation = useLogin();
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === "admin") setLocation("/admin");
      else if (user.role === "zhengji_staff") setLocation("/staff");
      else if (user.role === "kiri_partner") setLocation("/partner");
    }
  }, [isAuthenticated, user, setLocation]);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = (data: LoginFormValues) => {
    loginMutation.mutate({ data }, {
      onSuccess: (result) => {
        localStorage.setItem("zhengji_token", result.token);
        window.dispatchEvent(new Event("storage"));
        toast({ title: "Login successful | 登录成功" });
      },
      onError: () => {
        toast({
          title: "Login failed | 登录失败",
          description: "Please check your credentials.",
          variant: "destructive"
        });
      }
    });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col justify-center items-center p-4 bg-background">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-serif font-bold text-primary">Zhengji Wellness</h1>
          <p className="text-muted-foreground text-sm uppercase tracking-widest font-mono">Partner Portal</p>
        </div>
        
        <Card className="border-border shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Sign in | 登录</CardTitle>
            <CardDescription>
              Enter your credentials to access your dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username | 用户名</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter username..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password | 密码</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Enter password..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button 
                  type="submit" 
                  className="w-full font-semibold" 
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? "Signing in..." : "Sign In | 登录"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}