import { useCallback, useRef } from "react";
import { Moon, Sun } from "lucide-react";
import { flushSync } from "react-dom";

import { useThemeStore } from "@/shared/stores/themeStore";
import { cn } from "@/shared/lib/utils";

/**
 * ToggleTheme Component
 * Integrates Lightswind UI-inspired view transition animations.
 * 
 * Props:
 * - duration (number): Duration of the transition in milliseconds.
 * - animationType (string): Type of view transition animation to play.
 *   Available: "none", "circle-spread", "round-morph", "swipe-left", "swipe-up", 
 *   "diag-down-right", "fade-in-out", "shrink-grow", "flip-x-in", "split-vertical", 
 *   "swipe-right", "swipe-down", "wave-ripple"
 */
export const ToggleTheme = ({
    className,
    duration = 400,
    animationType = "swipe-left",
    ...props
}) => {
    const { isDarkMode, toggleDarkMode } = useThemeStore();
    const buttonRef = useRef(null);

    const toggleTheme = useCallback(async () => {
        if (!buttonRef.current) return;

        // Fallback for browsers that do not support the experimental View Transition API
        if (!document.startViewTransition) {
            toggleDarkMode();
            return;
        }

        // Wait for the DOM update to complete within the View Transition
        await document.startViewTransition(() => {
            flushSync(() => {
                toggleDarkMode();
            });
        }).ready;

        // Calculate coordinates and dimensions for spatial animations
        const { top, left, width, height } =
            buttonRef.current.getBoundingClientRect();
        const x = left + width / 2;
        const y = top + height / 2;
        const maxRadius = Math.hypot(
            Math.max(left, window.innerWidth - left),
            Math.max(top, window.innerHeight - top)
        );
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Implement the animation routing switch
        switch (animationType) {
            case "circle-spread":
                document.documentElement.animate(
                    {
                        clipPath: [
                            `circle(0px at ${x}px ${y}px)`,
                            `circle(${maxRadius}px at ${x}px ${y}px)`,
                        ],
                    },
                    {
                        duration,
                        easing: "ease-in-out",
                        pseudoElement: "::view-transition-new(root)",
                    }
                );
                break;

            case "round-morph":
                document.documentElement.animate(
                    [
                        { opacity: 0, transform: "scale(0.8) rotate(5deg)" },
                        { opacity: 1, transform: "scale(1) rotate(0deg)" },
                    ],
                    {
                        duration: duration * 1.2,
                        easing: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
                        pseudoElement: "::view-transition-new(root)",
                    }
                );
                break;

            case "swipe-left":
                document.documentElement.animate(
                    {
                        clipPath: [
                            `inset(0 0 0 ${viewportWidth}px)`,
                            `inset(0 0 0 0)`,
                        ],
                    },
                    {
                        duration,
                        easing: "cubic-bezier(0.2, 0, 0, 1)",
                        pseudoElement: "::view-transition-new(root)",
                    }
                );
                break;

            case "swipe-up":
                document.documentElement.animate(
                    {
                        clipPath: [
                            `inset(${viewportHeight}px 0 0 0)`,
                            `inset(0 0 0 0)`,
                        ],
                    },
                    {
                        duration,
                        easing: "cubic-bezier(0.2, 0, 0, 1)",
                        pseudoElement: "::view-transition-new(root)",
                    }
                );
                break;

            case "diag-down-right":
                document.documentElement.animate(
                    {
                        clipPath: [
                            `polygon(0 0, 0 0, 0 0, 0 0)`,
                            `polygon(0 0, 100% 0, 100% 100%, 0 100%)`,
                        ],
                    },
                    {
                        duration: duration * 1.5,
                        easing: "cubic-bezier(0.4, 0, 0.2, 1)",
                        pseudoElement: "::view-transition-new(root)",
                    }
                );
                break;

            case "fade-in-out":
                document.documentElement.animate(
                    {
                        opacity: [0, 1],
                    },
                    {
                        duration: duration * 0.5,
                        easing: "ease-in-out",
                        pseudoElement: "::view-transition-new(root)",
                    }
                );
                break;

            case "shrink-grow":
                document.documentElement.animate(
                    [
                        { transform: "scale(0.9)", opacity: 0 },
                        { transform: "scale(1)", opacity: 1 },
                    ],
                    {
                        duration: duration * 1.2,
                        easing: "cubic-bezier(0.19, 1, 0.22, 1)",
                        pseudoElement: "::view-transition-new(root)",
                    }
                );
                document.documentElement.animate(
                    [
                        { transform: "scale(1)", opacity: 1 },
                        { transform: "scale(1.05)", opacity: 0 },
                    ],
                    {
                        duration: duration * 1.2,
                        easing: "cubic-bezier(0.19, 1, 0.22, 1)",
                        pseudoElement: "::view-transition-old(root)",
                    }
                );
                break;

            case "flip-x-in": {
                const styleElement = document.createElement("style");
                styleElement.textContent = `
                    ::view-transition-group(root) { perspective: 1000px; }
                    ::view-transition-old(root) { transform-origin: center; animation: flip-out 400ms forwards; }
                    ::view-transition-new(root) { transform-origin: center; animation: flip-in 400ms forwards; }
                    
                    @keyframes flip-out { from { transform: rotateY(0deg); opacity: 1; } to { transform: rotateY(-90deg); opacity: 0; } }
                    @keyframes flip-in { from { transform: rotateY(90deg); opacity: 0; } to { transform: rotateY(0deg); opacity: 1; } }
                `;
                document.head.appendChild(styleElement);
                break;
            }

            case "split-vertical":
                document.documentElement.animate(
                    [{ opacity: 0 }, { opacity: 1 }],
                    {
                        duration: duration * 0.75,
                        easing: "ease-in",
                        pseudoElement: "::view-transition-new(root)",
                    }
                );
                document.documentElement.animate(
                    [
                        { clipPath: "inset(0 0 0 0)", transform: "none" },
                        { clipPath: "inset(0 40% 0 40%)", transform: "scale(1.2)" },
                        { clipPath: "inset(0 50% 0 50%)", transform: "scale(1)" },
                    ],
                    {
                        duration: duration * 1.5,
                        easing: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
                        pseudoElement: "::view-transition-old(root)",
                    }
                );
                break;

            case "swipe-right":
                document.documentElement.animate(
                    {
                        clipPath: [
                            `inset(0 ${viewportWidth}px 0 0)`,
                            `inset(0 0 0 0)`,
                        ],
                    },
                    {
                        duration,
                        easing: "cubic-bezier(0.2, 0, 0, 1)",
                        pseudoElement: "::view-transition-new(root)",
                    }
                );
                break;

            case "swipe-down":
                document.documentElement.animate(
                    {
                        clipPath: [
                            `inset(0 0 ${viewportHeight}px 0)`,
                            `inset(0 0 0 0)`,
                        ],
                    },
                    {
                        duration,
                        easing: "cubic-bezier(0.2, 0, 0, 1)",
                        pseudoElement: "::view-transition-new(root)",
                    }
                );
                break;

            case "wave-ripple":
                document.documentElement.animate(
                    {
                        clipPath: [
                            `circle(0% at 50% 50%)`,
                            `circle(${maxRadius}px at 50% 50%)`,
                        ],
                    },
                    {
                        duration: duration * 1.5,
                        easing: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
                        pseudoElement: "::view-transition-new(root)",
                    }
                );
                break;

            case "none":
            default:
                break;
        }

    }, [duration, animationType, toggleDarkMode]);

    return (
        <>
            <button
                ref={buttonRef}
                onClick={toggleTheme}
                className={cn(
                    "p-2 rounded-full transition-all duration-300 group",
                    isDarkMode ? "hover:text-amber-400 hover:bg-amber-400/5" : "hover:text-primary hover:bg-primary/5",
                    className
                )}
                title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                {...props}
            >
                <div className="transition-transform duration-300 group-hover:rotate-45 active:scale-75">
                    {isDarkMode ? (
                        <Sun className="h-5 w-5 text-amber-500" />
                    ) : (
                        <Moon className="h-5 w-5 text-indigo-400" />
                    )}
                </div>
            </button>

            {animationType !== "flip-x-in" && (
                <style
                    dangerouslySetInnerHTML={{
                        __html: `
                            ::view-transition-old(root),
                            ::view-transition-new(root) {
                                animation: none;
                                mix-blend-mode: normal;
                            }
                        `,
                    }}
                />
            )}
        </>
    );
};
