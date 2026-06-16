import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      theme="dark"
      position="top-right"
      offset={16}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:border-primary/25 group-[.toaster]:bg-card/95 group-[.toaster]:text-foreground group-[.toaster]:shadow-[0_18px_48px_rgba(0,0,0,0.35)] group-[.toaster]:backdrop-blur",
          title: "group-[.toast]:font-display group-[.toast]:font-black",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:font-medium",
          success: "group-[.toaster]:border-primary/45",
          icon: "group-[.toast]:text-primary",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
