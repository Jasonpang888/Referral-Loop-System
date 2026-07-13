import { useGetReferralPage, useCreateLead, useCheckDuplicate, getCheckDuplicateQueryKey, LeadInputLang } from "@workspace/api-client-react";
import { useParams } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

const leadSchema = z.object({
  name: z.string().min(2, "Name is required"),
  mobile: z.string().min(5, "Mobile number is required"),
  whatsapp: z.string().optional(),
  kirimembershipId: z.string().min(1, "Kiri Membership ID is required"),
  consentGiven: z.boolean().refine(val => val === true, {
    message: "You must agree to the privacy policy",
  }),
});

type LeadFormValues = z.infer<typeof leadSchema>;

export default function ReferralLanding() {
  const { code } = useParams<{ code: string }>();
  const { data: pageData, isLoading, isError } = useGetReferralPage(code);
  const createLead = useCreateLead();
  const { toast } = useToast();

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      name: "",
      mobile: "",
      whatsapp: "",
      kirimembershipId: "",
      consentGiven: false,
    },
  });

  const watchedMobile = form.watch("mobile");
  const watchedMembershipId = form.watch("kirimembershipId");
  const duplicateParams = { mobile: watchedMobile || undefined, membershipId: watchedMembershipId || undefined };
  const { data: duplicate } = useCheckDuplicate(
    duplicateParams,
    { query: { queryKey: getCheckDuplicateQueryKey(duplicateParams), enabled: watchedMobile.length >= 5 || watchedMembershipId.length > 0 } },
  );

  const onSubmit = (data: LeadFormValues) => {
    if (!pageData) return;
    if (duplicate?.isDuplicate) {
      toast({
        title: "Duplicate referral | 重复推荐",
        description: "This mobile or membership ID already exists in the referral pipeline.",
        variant: "destructive",
      });
      return;
    }
    
    createLead.mutate({
      data: {
        ...data,
        referralCode: pageData.referralCode,
        selectedOffer: pageData.offer,
        lang: LeadInputLang.en
      }
    }, {
      onSuccess: () => {
        toast({
          title: "Success! | 成功！",
          description: "Your consultation request has been submitted. We will contact you soon. | 您的咨询请求已提交，我们将尽快与您联系。",
        });
        form.reset();
      },
      onError: () => {
        toast({
          title: "Error | 错误",
          description: "Failed to submit request. Please try again. | 提交请求失败，请重试。",
          variant: "destructive"
        });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background p-4 flex flex-col items-center pt-12">
        <Skeleton className="w-full max-w-lg h-96 rounded-xl" />
      </div>
    );
  }

  if (isError || !pageData) {
    return (
      <div className="min-h-[100dvh] bg-background p-4 flex flex-col items-center pt-12 text-center">
        <h1 className="text-2xl font-bold text-destructive">Offer not found | 未找到优惠</h1>
        <p className="mt-2 text-muted-foreground">This referral link may be invalid or expired.</p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background py-12 px-4 flex flex-col items-center">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-serif font-bold text-primary">Zhengji Wellness</h1>
          <p className="text-lg text-foreground font-medium">
            Invited by <span className="text-accent">{pageData.partnerName}</span>
          </p>
          
          <div className="bg-primary/10 p-6 rounded-xl border border-primary/20">
            <h2 className="text-2xl font-bold text-primary mb-2">Special Offer | 特别优惠</h2>
            <p className="text-foreground">{pageData.offer}</p>
            {pageData.offerZh && <p className="text-muted-foreground mt-1">{pageData.offerZh}</p>}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Claim Your Offer | 领取优惠</CardTitle>
            <CardDescription>
              Fill out the form below to book your free consultation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name | 全名</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="mobile"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mobile | 手机号</FormLabel>
                        <FormControl>
                          <Input placeholder="+60123456789" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="whatsapp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>WhatsApp (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="+60123456789" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="kirimembershipId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kiri Membership ID | Kiri会员号</FormLabel>
                      <FormControl>
                        <Input placeholder="KIRI-1234" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {duplicate?.isDuplicate && (
                  <p className="text-sm text-destructive">
                    Duplicate {duplicate.field ?? "record"} found. Please contact Zhengji staff if this is incorrect.
                  </p>
                )}

                <FormField
                  control={form.control}
                  name="consentGiven"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 border rounded-md">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          I consent to the privacy policy | 我同意隐私政策
                        </FormLabel>
                      </div>
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={createLead.isPending}>
                  {createLead.isPending ? "Submitting..." : "Claim Offer | 领取优惠"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
